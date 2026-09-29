#!/usr/bin/env python3
"""Prepare a fresh local Pages checkout fixture, never a production import.

Run after CONTENT_SNAPSHOT_SOURCE=committed npm run build. The printed server
command uses the SAME config and persistence directory as the local D1 import.
No existing database, .dev.vars, provider credential or customer export is copied.
"""
import importlib.util
import json
import os
from pathlib import Path
import shlex
import shutil
import sqlite3
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Build the committed snapshot first.')
    folder = Path(tempfile.mkdtemp(prefix='salty-checkout-fixture-'))
    shutil.copytree(ROOT / 'functions', folder / 'functions')
    (folder / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
    shutil.copytree(ROOT / 'dist', folder / 'dist')
    (folder / '.dev.vars').write_text('''# Disposable localhost only; no provider credentials or outbound email.
DEV_ADMIN_BYPASS=1
MAIL_DRY_RUN=true
STRIPE_TEST_ONLY=1
POSTCODE_SUGGESTIONS_SOURCE=local
SITE_URL=http://127.0.0.1:8789
''')
    (folder / 'wrangler.toml').write_text('''name = "salty-checkout-fixture"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"
[[d1_databases]]
binding = "DB"
database_name = "checkout-fixture"
database_id = "00000000-0000-4000-8000-000000000099"
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "local-checkout-fixture-images"
''')
    spec = importlib.util.spec_from_file_location('planner', ROOT / 'scripts/plan-production-migrations.py')
    planner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(planner)
    db = sqlite3.connect(':memory:')
    planner.rehearse(db, seed=True)
    db.executemany('INSERT INTO uk_postcodes VALUES (?,?)', [('SW1A1AA', 'SW1A 1AA'), ('SW1A2AA', 'SW1A 2AA')])
    db.commit()
    (folder / 'fixture.sql').write_text('-- DISPOSABLE LOCAL TEST DATA ONLY\n' + planner.bootstrap_dump(db))
    db.close()
    # Explicit allowlist prevents inherited Cloudflare or payment credentials.
    env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR') if key in os.environ}
    env['WRANGLER_SEND_METRICS'] = 'false'
    wrangler = str(ROOT / 'node_modules/.bin/wrangler')
    common = ['--config', str(folder / 'wrangler.toml'), '--persist-to', str(folder / 'state')]
    command = [wrangler, 'd1', 'execute', 'DB', '--local', *common, '--file', str(folder / 'fixture.sql')]
    result = subprocess.run(command, cwd=folder, env=env, text=True, capture_output=True)
    (folder / 'bootstrap.log').write_text(result.stdout + result.stderr)
    if result.returncode:
        raise SystemExit('Local bootstrap failed. Inspect ' + str(folder / 'bootstrap.log'))
    # Pages rejects --config; it discovers this same standard file from cwd.
    server = [wrangler, 'pages', 'dev', 'dist', '--persist-to', str(folder / 'state'), '--ip', '127.0.0.1', '--port', '8789']
    (folder / 'fixture.json').write_text(json.dumps({'local_only': True, 'postcode_rows': 2,
        'bootstrap_command': command, 'server_command': server, 'cwd': str(folder)}, indent=2) + '\n')
    print(folder)
    print('cd ' + shlex.quote(str(folder)) + ' && env -i HOME="$HOME" PATH="$PATH" WRANGLER_SEND_METRICS=false ' + shlex.join(server))


if __name__ == '__main__':
    main()
