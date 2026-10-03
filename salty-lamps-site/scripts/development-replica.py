#!/usr/bin/env python3
"""Snapshot live images and prepare a private, safe development database copy.

No writes to live resources. Import is separate and must target an empty development DB.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import urllib.parse

spec = importlib.util.spec_from_file_location('owner', Path(__file__).with_name('cloudflare-owner.py'))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)

CATALOGUE_TABLES = frozenset(('categories', 'category_aliases', 'collection_categories',
    'collection_sections', 'collections', 'content_list_items', 'content_pages',
    'content_snippets', 'content_themes', 'email_templates', 'product_images',
    'production_migration_ledger', 'products', 'reviews', 'settings', 'sku_images',
    'sku_weights', 'skus', 'theme_images', 'uk_postcodes',
    'staging_image_objects', 'staging_image_chunks'))
LIVE_BUCKET = 'salty-lamps-images'
DEV_BUCKET = 'salty-lamps-development-images'


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def list_images(api, bucket):
    base = f'/accounts/{owner.OWNER}/r2/buckets/{bucket}/objects'
    images, cursor, seen = [], None, set()
    while True:
        query = {'per_page': 1000}
        if cursor:
            query['cursor'] = cursor
        body = json.loads(api.request(base + '?' + urllib.parse.urlencode(query), raw=True))
        if not body.get('success') or not isinstance(body.get('result'), list):
            raise ValueError('Image listing failed')
        images.extend(body['result'])
        info = body.get('result_info', {})
        # The older owner-account API returns no result_info for short listings.
        # Refuse ambiguous full pages rather than silently miss any image objects.
        if info.get('is_truncated') is False or (not info and len(body['result']) < 1000):
            break
        cursor = info.get('cursor')
        if not cursor or cursor in seen:
            raise ValueError('Incomplete image listing')
        seen.add(cursor)
    keys = [i['key'] for i in images]
    if len(keys) != len(set(keys)):
        raise ValueError('Duplicate image keys')
    return sorted(images, key=lambda i: i['key'])


def snapshot_images(folder):
    api = owner.OwnerAPI()
    images = list_images(api, LIVE_BUCKET)
    (folder / 'images').mkdir(exist_ok=True)
    manifest = []
    for index, image in enumerate(images):
        key = image['key']
        data = api.request(f'/accounts/{owner.OWNER}/r2/buckets/{LIVE_BUCKET}/objects/'
                           + urllib.parse.quote(key, safe=''), raw=True)
        if len(data) != image['size'] or hashlib.md5(data).hexdigest() != image['etag']:
            raise ValueError('Image changed or checksum did not match')
        filename = f'{index:05d}.bin'
        (folder / 'images' / filename).write_bytes(data)
        manifest.append({**image, 'file': filename, 'sha256': hashlib.sha256(data).hexdigest()})
    if images != list_images(api, LIVE_BUCKET):
        raise ValueError('Live images changed during the snapshot')
    write_json(folder / 'image-manifest.json', {'status': 'verified', 'bucket': LIVE_BUCKET,
        'objects': manifest, 'bytes': sum(i['size'] for i in images)})
    print(f'All {len(images)} live image objects copied and checksum verified.')


def prepare_database(folder):
    raw = (folder / 'database.sql').read_bytes()
    manifest = json.loads((folder / 'database-manifest.json').read_text())
    if manifest.get('status') != 'verified' or hashlib.sha256(raw).hexdigest() != manifest['sha256']:
        raise ValueError('Verified live snapshot required')
    destination = folder / 'development.sqlite'
    if destination.exists():
        raise ValueError('Development copy already exists; use a new snapshot')
    db = sqlite3.connect(destination)
    try:
        db.executescript('BEGIN;\n' + raw.decode() + '\nCOMMIT;')
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        if not CATALOGUE_TABLES <= tables:
            raise ValueError('Catalogue schema is incomplete')
        for name in sorted(tables - CATALOGUE_TABLES):
            db.execute('DELETE FROM "' + name.replace('"', '""') + '"')
        # Legacy database image chunks are inactive in the live R2 configuration.
        # R2 is copied separately; importing these large base64 statements is unnecessary.
        db.execute('DELETE FROM staging_image_chunks')
        db.execute('DELETE FROM staging_image_objects')
        db.execute("UPDATE settings SET value='0' WHERE key='email_enabled'")
        db.execute("UPDATE settings SET value='https://test.saltylamps.co.uk' WHERE key='site_url'")
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('deployment_environment','development')")
        # Launch acceptance is for production, never silently inherited by development.
        db.execute("DELETE FROM settings WHERE key LIKE 'launch_review%' OR key LIKE 'launch-review%'")
        db.commit()
        if list(db.execute('PRAGMA integrity_check')) != [('ok',)] or list(db.execute('PRAGMA foreign_key_check')):
            raise ValueError('Development database integrity or foreign keys failed')
        planner_spec = importlib.util.spec_from_file_location('planner', Path(__file__).with_name('plan-production-migrations.py'))
        planner = importlib.util.module_from_spec(planner_spec)
        planner_spec.loader.exec_module(planner)
        dump = planner.bootstrap_dump(db)
        for statement in planner.statements(dump):
            if len(statement.encode()) > 100_000:
                raise ValueError('Development import contains a statement larger than D1 permits')
        # Rehearse the exact emitted SQL with foreign keys on, as on remote D1.
        rehearsal = sqlite3.connect(':memory:')
        rehearsal.execute('PRAGMA foreign_keys=ON')
        rehearsal.executescript(dump)
        if list(rehearsal.execute('PRAGMA foreign_key_check')):
            raise ValueError('Development import rehearsal failed')
        rehearsal.close()
        (folder / 'development.sql').write_text(dump)
        counts = {name: db.execute('SELECT COUNT(*) FROM "' + name + '"').fetchone()[0] for name in sorted(tables)}
        write_json(folder / 'development-manifest.json', {'source_sha256': manifest['sha256'],
            'sql_sha256': hashlib.sha256((folder / 'development.sql').read_bytes()).hexdigest(),
            'rows': counts, 'catalogue_tables': sorted(CATALOGUE_TABLES),
            'operational_tables_emptied': sorted(tables - CATALOGUE_TABLES),
            'email_enabled': False, 'site_url': 'https://test.saltylamps.co.uk'})
    finally:
        db.close()
    print('Development copy prepared: identical catalogue; empty customer operations; email disabled.')


def copy_images(folder):
    images = json.loads((folder / 'image-manifest.json').read_text())
    if images.get('status') != 'verified' or images.get('bucket') != LIVE_BUCKET:
        raise ValueError('A verified live image snapshot is required')
    api = owner.OwnerAPI()
    if list_images(api, DEV_BUCKET):
        raise ValueError('Development image bucket must be empty; existing work is never overwritten')
    for image in images['objects']:
        path = folder / 'images' / image['file']
        if path.parent != folder / 'images' or hashlib.sha256(path.read_bytes()).hexdigest() != image['sha256']:
            raise ValueError('Image snapshot checksum failed')
        subprocess.run([str(owner.ROOT / 'node_modules/.bin/wrangler'), 'r2', 'object', 'put',
            DEV_BUCKET + '/' + image['key'], '--remote', '--file', str(path),
            '--content-type', image.get('http_metadata', {}).get('contentType', 'application/octet-stream')],
            check=True, capture_output=True, env={**os.environ, 'CLOUDFLARE_ACCOUNT_ID': owner.OWNER})
    copied = list_images(api, DEV_BUCKET)
    if [(i['key'], i['size'], i['etag']) for i in copied] != [(i['key'], i['size'], i['etag']) for i in images['objects']]:
        raise ValueError('Development image copy did not match the snapshot')
    write_json(folder / 'development-images-verified.json', copied)
    marker = folder / 'development-image-marker.json'
    write_json(marker, {'environment': 'development', 'bucket': DEV_BUCKET})
    subprocess.run([str(owner.ROOT / 'node_modules/.bin/wrangler'), 'r2', 'object', 'put',
        DEV_BUCKET + '/_environment/development.json', '--remote', '--file', str(marker),
        '--content-type', 'application/json'], check=True, capture_output=True,
        env={**os.environ, 'CLOUDFLARE_ACCOUNT_ID': owner.OWNER})
    actual = json.loads(api.request(f'/accounts/{owner.OWNER}/r2/buckets/{DEV_BUCKET}/objects/'
                                   + urllib.parse.quote('_environment/development.json', safe=''), raw=True))
    if actual != json.loads(marker.read_text()):
        raise ValueError('Development image identity could not be verified')
    print(f'{len(copied)} images copied to the separate development bucket and verified.')


def verify_database(folder):
    api = owner.OwnerAPI()
    # Pinned IDs: this verification can only SELECT the isolated replica.
    db = sqlite3.connect(f'file:{folder / "development.sqlite"}?mode=ro', uri=True)
    expected = json.loads((folder / 'development-manifest.json').read_text())
    tables = sorted(expected['rows'])
    sql = '; '.join('SELECT * FROM "' + table + '"' for table in tables)
    sets = api.request(f'/accounts/{owner.OWNER}/d1/database/62066199-f4b8-4026-8dd2-b56a10cd975d/query',
                       method='POST', payload={'sql': sql})
    if len(sets) != len(tables):
        raise ValueError('Development database verification returned incomplete results')
    hashes = {}
    for table, result in zip(tables, sets):
        if result.get('success') is False:
            raise ValueError('Development database verification query failed')
        columns = [row[1] for row in db.execute('PRAGMA table_info("' + table + '")')]
        remote = sorted(repr(tuple(row[column] for column in columns)) for row in result['results'])
        local = sorted(repr(tuple(row)) for row in db.execute('SELECT * FROM "' + table + '"'))
        if local != remote:
            raise ValueError('Development copy differs from the prepared snapshot in ' + table)
        hashes[table] = hashlib.sha256('\n'.join(remote).encode()).hexdigest()
    db.close()
    write_json(folder / 'development-database-verified.json', {'status': 'verified', 'table_hashes': hashes})
    print(f'All {len(tables)} development tables match the safe prepared copy exactly.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['snapshot-images', 'prepare-database', 'copy-images', 'verify-database'])
    parser.add_argument('folder', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    folder = args.folder.resolve()
    if owner.ROOT.parent == folder or owner.ROOT.parent in folder.parents:
        sys.exit('Private copies must be outside the repository')
    try:
        {'snapshot-images': snapshot_images, 'prepare-database': prepare_database,
         'copy-images': copy_images, 'verify-database': verify_database}[args.action](folder)
    except subprocess.CalledProcessError:
        sys.exit('Cloudflare command failed; no provider output was printed because it may contain private data')
    except Exception as error:
        sys.exit(str(error))
