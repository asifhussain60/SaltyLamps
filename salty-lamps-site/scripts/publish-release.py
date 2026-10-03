#!/usr/bin/env python3
"""Publish code to isolated test or promote the tested commit to live. Never sync live data."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path.home() / 'salty-lamps-private'
OWNER = 'e35d5918c507bc2cf4e920fe38b5e318'
PROJECT = 'salty-lamps-development'
RECEIPT = PRIVATE / 'last-development-release.json'
SIGN_OFF = PRIVATE / 'development-sign-off.json'
DEVELOPMENT_BRANCH = 'develop'


def run(args, cwd=ROOT, env=None, capture=False):
    return subprocess.run(args, cwd=cwd, env=env, check=True,
        text=True, capture_output=capture)


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def release_files(root=ROOT):
    # Include untracked source; exclude dependencies, local credentials and generated output.
    files = []
    for directory in ('src', 'functions', 'public', 'scripts', 'd1/migrations', 'test', 'docs/diagrams'):
        files += [p for p in (root / directory).rglob('*') if p.is_file()
                  and '__pycache__' not in p.parts and p.suffix not in ('.pyc', '.bak')]
    files += [root / name for name in ('index.html', 'package.json', 'package-lock.json', 'vite.config.js',
        'postcss.config.js', 'tailwind.config.js', 'wrangler.development.toml',
        'wrangler.live.toml', 'publish.sh', 'deploy-live.sh') if (root / name).exists()]
    return sorted(set(files))


def fingerprint(files, root=ROOT):
    digest = hashlib.sha256()
    for path in files:
        digest.update(str(path.relative_to(root)).encode() + b'\0')
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def verify_resources(api, target):
    development = target == 'test'
    config = tomllib.loads((ROOT / ('wrangler.development.toml' if development else 'wrangler.live.toml')).read_text())
    db_id = config['d1_databases'][0]['database_id']
    bucket = config['r2_buckets'][0]['bucket_name']
    rows = api.request(f'/accounts/{OWNER}/d1/database/{db_id}/query', method='POST',
        payload={'sql': "SELECT value FROM settings WHERE key='deployment_environment'"})[0]['results']
    actual = rows[0]['value'] if rows else 'production'
    if actual != ('development' if development else 'production'):
        raise ValueError('Database identity does not match the release destination')
    objects = load_module('development-replica').list_images(api, bucket)
    marker_key = '_environment/development.json'
    marked = any(item['key'] == marker_key for item in objects)
    if development != marked:
        raise ValueError('Image storage identity does not match the release destination')
    if development:
        marker = json.loads(api.request(f'/accounts/{OWNER}/r2/buckets/{bucket}/objects/_environment%2Fdevelopment.json', raw=True))
        if marker != {'environment': 'development', 'bucket': bucket}:
            raise ValueError('Development image identity is invalid')


def validate_release(receipt, commit, code_hash, dirty):
    if (receipt.get('environment') != 'development' or receipt.get('project') != PROJECT
            or receipt.get('branch') != DEVELOPMENT_BRANCH or not receipt.get('deployment_id')):
        raise ValueError('A verified develop deployment receipt is required')
    if receipt.get('fingerprint') != code_hash or receipt.get('commit') != commit:
        raise ValueError('Publish this exact committed version to test before promoting it')
    if receipt.get('dirty') or dirty:
        raise ValueError('Promotion requires a clean committed version already deployed to test')


def validate_sign_off(approval, receipt):
    for key in ('environment', 'project', 'branch', 'commit', 'fingerprint', 'deployment_id'):
        if approval.get(key) != receipt.get(key):
            raise ValueError('Sign-off belongs to another test release; review and sign off again')
    if (not approval.get('approved_by') or not approval.get('note')
            or approval.get('owner_accepted') is not True):
        raise ValueError('Owner acceptance and explicit production sign-off are required')


def verify_test_deployment(api, receipt):
    project = api.request(f'/accounts/{OWNER}/pages/projects/{PROJECT}')
    deployed = project['canonical_deployment']
    metadata = deployed['deployment_trigger']['metadata']
    if (project.get('production_branch') != DEVELOPMENT_BRANCH
            or deployed['id'] != receipt.get('deployment_id')
            or metadata.get('commit_hash') != receipt.get('commit')
            or metadata.get('branch') != DEVELOPMENT_BRANCH):
        raise ValueError('The hosted develop release has changed; publish and verify it again')
    return project


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', choices=['test', 'sign-off', 'live'])
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--approved-by')
    parser.add_argument('--note')
    parser.add_argument('--owner-accepted', action='store_true')
    parser.add_argument('--push', action='store_true', help='After successful live deployment, push main without force')
    args = parser.parse_args()
    os.umask(0o077)
    if os.environ.get('CLOUDFLARE_ACCOUNT_ID', OWNER) != OWNER:
        raise ValueError('Unexpected account in shell')
    config = tomllib.loads((ROOT / 'wrangler.development.toml').read_text())
    load_module('development-preflight').validate(config, os.environ)
    files = release_files()
    code_hash = fingerprint(files)
    commit = run(['git', 'rev-parse', 'HEAD'], capture=True).stdout.strip()
    branch = run(['git', 'branch', '--show-current'], capture=True).stdout.strip()
    if branch != DEVELOPMENT_BRANCH:
        raise ValueError('Run the release workflow from develop; main is the currently live code')
    tracked_dirty = bool(run(['git', 'status', '--porcelain', '--untracked-files=normal'], capture=True).stdout)
    if args.target in ('live', 'sign-off'):
        receipt = json.loads(RECEIPT.read_text())
        validate_release(receipt, commit, code_hash, tracked_dirty)
        if args.target == 'sign-off' and (not args.approved_by or not args.note or not args.owner_accepted or args.dry_run or args.push):
            raise ValueError('Sign-off requires --approved-by, --note and --owner-accepted after actual review')
        if args.target == 'live':
            if not SIGN_OFF.exists():
                raise ValueError('This test release has not been signed off for production')
            validate_sign_off(json.loads(SIGN_OFF.read_text()), receipt)
        api = load_module('cloudflare-owner').OwnerAPI()
        verify_resources(api, 'test')
        verify_test_deployment(api, receipt)
        if args.target == 'sign-off':
            approval = {key: receipt[key] for key in ('environment', 'project', 'branch', 'commit', 'fingerprint', 'deployment_id')}
            approval.update(approved_by=args.approved_by, note=args.note, owner_accepted=True,
                            signed_off_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
            SIGN_OFF.write_text(json.dumps(approval, indent=2) + '\n')
            print('Production sign-off recorded for this exact hosted develop release. Nothing was deployed.')
            return
        verify_resources(api, 'live')
        live_project = api.request(f'/accounts/{OWNER}/pages/projects/salty-lamps-staging')
        live_main = run(['git', 'rev-parse', 'refs/heads/main'], capture=True).stdout.strip()
        if (live_project.get('production_branch') != 'main' or live_project.get('source')
                or live_project['canonical_deployment']['deployment_trigger']['metadata']['commit_hash'] != live_main):
            raise ValueError('Main must match the current live release, with automatic live builds disabled')
        run(['git', 'merge-base', '--is-ancestor', live_main, commit], capture=True)
        worktrees = run(['git', 'worktree', 'list', '--porcelain'], capture=True).stdout
        if 'branch refs/heads/main' in worktrees:
            raise ValueError('Main is checked out elsewhere; close that checkout before promotion')
        if args.push:
            remote_main = run(['git', 'ls-remote', 'origin', 'refs/heads/main'], capture=True).stdout.split()
            if not remote_main or remote_main[0] != live_main:
                raise ValueError('Origin main differs from the current live release; reconcile before publishing')
        # Build/deploy from the tested commit in a private clone. Edits in the shared
        # checkout while backups or approval are pending cannot alter this release.
        repository = Path(run(['git', 'rev-parse', '--show-toplevel'], capture=True).stdout.strip())
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        work = PRIVATE / ('live-release-' + stamp)
        work.mkdir(parents=True)
        checkout = work / 'source'
        run(['git', 'clone', '--no-hardlinks', '--no-checkout', str(repository), str(checkout)], capture=True)
        run(['git', 'checkout', '--detach', commit], cwd=checkout, capture=True)
        release_root = checkout / ROOT.relative_to(repository)
        (release_root / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
        if fingerprint(release_files(release_root), release_root) != code_hash:
            raise ValueError('The committed release differs from the code reviewed in test')
        live_env = {**os.environ, 'CLOUDFLARE_ACCOUNT_ID': OWNER, 'LIVE_BRANCH': 'main',
                    'LIVE_DRY_RUN': '1' if args.dry_run else '0'}
        if args.dry_run:
            run(['bash', 'deploy-live.sh'], cwd=release_root, env=live_env)
        else:
            # Existing live path checks migrations, fresh catalogue, provider readiness,
            # creates its database recovery point and requires the owner's deploy phrase.
            run(['bash', 'scripts/snapshot-live.sh'], cwd=release_root, env=live_env)
            run(['bash', 'deploy-live.sh'], cwd=release_root, env=live_env)
            actual = api.request(f'/accounts/{OWNER}/pages/projects/salty-lamps-staging')['canonical_deployment']
            if actual['deployment_trigger']['metadata']['commit_hash'] != commit:
                raise ValueError('Live deployment did not confirm the reviewed commit; main was not advanced')
            run(['git', 'update-ref', 'refs/heads/main', commit, live_main])
            (work / 'live-receipt.json').write_text(json.dumps({'commit': commit,
                'deployment_id': actual['id'], 'signed_off_test_deployment': receipt['deployment_id']}, indent=2) + '\n')
            if args.push:
                run(['git', 'push', 'origin', 'refs/heads/main:refs/heads/main'])
            run(['node', 'scripts/live-check.mjs'], cwd=release_root, env=live_env)
        return
    if args.push or args.approved_by or args.note or args.owner_accepted:
        raise ValueError('Approval and push options do not apply to a test publish')
    if tracked_dirty and not args.dry_run:
        raise ValueError('Commit the develop changes before publishing test')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    work = PRIVATE / ('development-release-' + stamp)
    work.mkdir(parents=True)
    source = work / 'source'
    source.mkdir()
    for path in files:
        dest = source / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    (source / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    env = {**os.environ, 'CLOUDFLARE_ACCOUNT_ID': OWNER,
           'CONTENT_SNAPSHOT_SOURCE': 'committed', 'VITE_STAGING': '1'}
    env.pop('CONTENT_SNAPSHOT_PRODUCTION', None)
    # Some tests also check repository-level handover documents and fixtures.
    # Run from the complete checkout, then ensure every copied source byte still matches.
    for command, log in [(['npm', 'run', 'test:unit'], 'unit-check.log'),
                         ([sys.executable, '-m', 'unittest', 'discover', '-s', 'test', '-p', 'test_*preflight.py'], 'target-check.log')]:
        checked = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
        (work / log).write_text(checked.stdout + checked.stderr)
        checked.check_returncode()
    if fingerprint(release_files()) != code_hash:
        raise ValueError('Source changed while checks ran; publish again after editing stops')
    run(['npm', 'run', 'build'], cwd=source, env=env)
    receipt = {'environment': 'development', 'project': PROJECT, 'branch': DEVELOPMENT_BRANCH, 'commit': commit,
        'fingerprint': code_hash, 'dirty': tracked_dirty, 'source': str(source),
        'created_at': stamp, 'database_id': config['d1_databases'][0]['database_id'],
        'image_bucket': config['r2_buckets'][0]['bucket_name']}
    (source / 'dist' / 'release.json').write_text(json.dumps({k: receipt[k]
        for k in ('environment', 'branch', 'commit', 'fingerprint', 'dirty')}) + '\n')
    if args.dry_run:
        print('Test build and unit checks passed; no remote reads or writes.')
        return
    api = load_module('cloudflare-owner').OwnerAPI()
    verify_resources(api, 'test')
    project = api.request(f'/accounts/{OWNER}/pages/projects/{PROJECT}')
    if project.get('production_branch') != DEVELOPMENT_BRANCH or any(d in project.get('domains', [])
        for d in ('www.saltylamps.co.uk', 'admin.saltylamps.co.uk')):
        raise ValueError('Test project branch or hostnames are unsafe')
    # Back up development too: code deployment never silently discards ongoing tests.
    wr = str(ROOT / 'node_modules/.bin/wrangler')
    run([wr, '-c', 'wrangler.development.toml', 'd1', 'export', 'DB', '--remote',
         '--output', str(work / 'development-before.sql')], env=env, capture=True)
    bookmark = run([wr, '-c', 'wrangler.development.toml', 'd1', 'time-travel', 'info', 'DB', '--json'],
                   env=env, capture=True).stdout
    (work / 'development-time-travel-before.json').write_text(bookmark)
    (source / 'wrangler.toml').write_text('\n'.join(line for line in (ROOT / 'wrangler.development.toml').read_text().splitlines()
                                               if not line.startswith('account_id')) + '\n')
    run([wr, 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', DEVELOPMENT_BRANCH,
         '--commit-hash', commit, '--commit-message', 'development release ' + commit[:7],
         '--commit-dirty=' + str(tracked_dirty).lower()], cwd=source, env=env)
    deployed = api.request(f'/accounts/{OWNER}/pages/projects/{PROJECT}')['canonical_deployment']
    if (deployed['deployment_trigger']['metadata'].get('commit_hash') != commit
            or deployed['deployment_trigger']['metadata'].get('branch') != DEVELOPMENT_BRANCH):
        raise ValueError('Remote development release identity did not match')
    receipt['deployment_id'] = deployed['id']
    (work / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print('Development release published. Live data and the public shop were not changed.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError:
        sys.exit('Release command failed. Inspect the private release folder; provider output was not echoed.')
    except Exception as error:
        sys.exit(str(error))
