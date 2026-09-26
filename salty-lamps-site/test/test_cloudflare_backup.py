import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
import urllib.parse
import os
import shutil
import subprocess
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('backup', ROOT / 'scripts/cloudflare-backup.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


class Response(io.BytesIO):
    def __init__(self, content, headers=None):
        super().__init__(content)
        self.headers = headers or {}


def listing(objects, truncated=False, token=None):
    import xml.sax.saxutils as xml
    rows = ''.join('<Contents><Key>' + xml.escape(urllib.parse.quote(key, safe='')) + '</Key><Size>' + str(len(value)) + '</Size><ETag>"etag"</ETag></Contents>' for key, value in objects.items())
    return ('<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>shop-images</Name><EncodingType>url</EncodingType><KeyCount>' + str(len(objects)) + '</KeyCount>' + rows + '<IsTruncated>' + str(truncated).lower() + '</IsTruncated>' + ('<NextContinuationToken>' + xml.escape(token) + '</NextContinuationToken>' if token else '') + '</ListBucketResult>').encode()


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.folder = pathlib.Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def client(self, opener):
        return b.R2('1' * 32, 'fixture-access', 'fixture-secret', 'shop-images', opener)

    def database(self, extra='', expected=None):
        sql = 'CREATE TABLE products(id TEXT PRIMARY KEY); INSERT INTO products VALUES (\'a\'),(\'b\'); CREATE TABLE skus(id INTEGER PRIMARY KEY,product_id TEXT REFERENCES products(id)); CREATE TABLE orders(id TEXT); CREATE TABLE order_items(order_id TEXT); CREATE TABLE settings(key TEXT); CREATE TABLE product_images(id INTEGER);' + extra
        (self.folder / 'database.sql').write_text(sql)
        rows = {'products': 2, 'skus': 0, 'orders': 0, 'order_items': 0, 'settings': 0, 'product_images': 0}
        if expected:
            rows.update(expected)
        raw = [{'success': True, 'results': [{'table_name': name, 'row_count': count} for name, count in rows.items()]}]
        for name in ['counts-before.json', 'counts-after.json']:
            (self.folder / name).write_text(json.dumps(raw))
        db = sqlite3.connect(':memory:')
        db.executescript(sql)
        schema = [{'type': r[0], 'name': r[1], 'tbl_name': r[2]} for r in db.execute("SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL")]
        db.close()
        for name in ['schema-before.json', 'schema-after.json']:
            (self.folder / name).write_text(json.dumps([{'success': True, 'results': schema}]))

    def test_count_inventory_avoids_d1_compound_select_limit(self):
        names = ['table_' + str(i) for i in range(50)]
        path = self.folder / 'tables.json'
        path.write_text(json.dumps([{'success': True, 'results': [{'table_name': name} for name in names]}]))
        query = b.count_query(path)
        self.assertNotIn('UNION', query)
        db = sqlite3.connect(':memory:')
        try:
            for name in names:
                db.execute('CREATE TABLE "' + name + '"(id INTEGER)')
                db.execute('INSERT INTO "' + name + '" VALUES(1)')
            counts = [db.execute(statement).fetchone() for statement in query.split(';') if statement.strip()]
            self.assertEqual(counts, [(name, 1) for name in names])
        finally:
            db.close()

    def test_large_postcode_reference_is_restored_without_remote_count_scan(self):
        self.database(extra='CREATE TABLE uk_postcodes(postcode_key TEXT); INSERT INTO uk_postcodes VALUES (\'AB1\'),(\'AB2\');')
        inventory = self.folder / 'tables.json'
        inventory.write_text(json.dumps([{'success': True, 'results': [{'table_name': name} for name in ['products', 'uk_postcodes']]}]))
        self.assertNotIn('uk_postcodes', b.count_query(inventory))
        result = b.verify_database(self.folder)
        self.assertEqual(result['rows']['uk_postcodes'], 2)
        self.assertEqual(result['source_count_unverified_tables'], ['uk_postcodes'])
        b.finish(self.folder, images=False)
        self.assertIn('Source row counts not checked for uk_postcodes', json.loads((self.folder / 'manifest.json').read_text())['consistency'])

    def test_restore_counts_multi_row_inserts_and_database_only_manifest(self):
        self.database()
        result = b.verify_database(self.folder)
        self.assertEqual(result['rows']['products'], 2)
        self.assertEqual(result['status'], 'verified')
        b.finish(self.folder, images=False)
        manifest = json.loads((self.folder / 'manifest.json').read_text())
        self.assertEqual(manifest['scope'], 'database-only')
        self.assertEqual(manifest['images']['status'], 'omitted-explicitly')

    def test_restore_rejects_syntax_truncation_missing_rows_and_foreign_keys(self):
        for kind in ['syntax', 'missing-row', 'foreign-key', 'missing-index']:
            with self.subTest(kind=kind):
                self.database(extra="INSERT INTO skus VALUES(1,'absent');" if kind == 'foreign-key' else '', expected={'skus': 1} if kind == 'foreign-key' else None)
                if kind == 'missing-index':
                    for name in ['schema-before.json', 'schema-after.json']:
                        raw = json.loads((self.folder / name).read_text())
                        raw[0]['results'].append({'type': 'index', 'name': 'lost_index', 'tbl_name': 'products'})
                        (self.folder / name).write_text(json.dumps(raw))
                if kind == 'syntax':
                    with (self.folder / 'database.sql').open('a') as out:
                        out.write('INSERT INTO products VALUES (')
                if kind == 'missing-row':
                    text = (self.folder / 'database.sql').read_text().replace("('a'),('b')", "('a')")
                    (self.folder / 'database.sql').write_text(text)
                with self.assertRaises(Exception):
                    b.verify_database(self.folder)
                self.assertFalse((self.folder / 'database-manifest.json').exists())

    def test_counts_reject_remote_failure_and_concurrent_changes(self):
        self.database()
        (self.folder / 'counts-after.json').write_text('[{"success":false,"results":[]}]')
        with self.assertRaises(ValueError):
            b.verify_database(self.folder)
        self.database()
        after = json.loads((self.folder / 'counts-after.json').read_text())
        after[0]['results'][0]['row_count'] = 3
        (self.folder / 'counts-after.json').write_text(json.dumps(after))
        with self.assertRaisesRegex(ValueError, 'changed'):
            b.verify_database(self.folder)

    def test_paginated_exact_key_copy_and_hash_mapping(self):
        objects = {'a/b': b'one', 'a_b': b'two', '../snow ☃\n100%.png': b'three'}
        requests = []
        def opener(request, timeout):
            requests.append(request)
            self.assertEqual(timeout, 60)
            self.assertIn('/auto/s3/aws4_request', request.get_header('Authorization'))
            parsed = urllib.parse.urlsplit(request.full_url)
            self.assertEqual(parsed.hostname, '1' * 32 + '.r2.cloudflarestorage.com')
            if parsed.query:
                query = urllib.parse.parse_qs(parsed.query)
                self.assertEqual(query['encoding-type'], ['url'])
                if 'continuation-token' not in query:
                    return Response(listing({'a/b': b'one'}, True, 'token +/='))
                self.assertEqual(query['continuation-token'], ['token +/='])
                return Response(listing({key: value for key, value in objects.items() if key != 'a/b'}))
            key = urllib.parse.unquote(parsed.path.removeprefix('/shop-images/'))
            self.assertEqual(request.get_header('If-match'), '"etag"')
            return Response(objects[key], {'ETag': '"etag"', 'Content-Length': str(len(objects[key]))})
        result = b.backup_images(self.folder, self.client(opener))
        self.assertEqual(result['count'], 3)
        self.assertEqual(len({row['file'] for row in result['objects']}), 3)
        self.assertEqual(len(requests), 7)
        for row in result['objects']:
            self.assertEqual((self.folder / row['file']).read_bytes(), objects[row['key']])
            self.assertEqual(len(row['sha256']), 64)

    def test_malformed_listing_does_not_become_empty_success(self):
        for content in [b'not xml', b'<Error/>', listing({}, True), listing({}, True, 'same')]:
            with self.subTest(content=content):
                with self.assertRaises(Exception):
                    self.client(lambda *args, **kwargs: Response(content)).listing()

    def test_failed_changed_truncated_downloads_issue_no_manifest(self):
        for kind in ['network', 'etag', 'length', 'truncated', 'changed-inventory']:
            with self.subTest(kind=kind):
                target = self.folder / kind
                target.mkdir()
                calls = 0
                def opener(request, **kwargs):
                    nonlocal calls
                    if '?' in request.full_url:
                        calls += 1
                        return Response(listing({} if kind == 'changed-inventory' and calls > 1 else {'one': b'abc'}))
                    if kind == 'network':
                        raise OSError('stub network failure')
                    return Response(b'ab' if kind == 'truncated' else b'abc', {'ETag': 'changed' if kind == 'etag' else '"etag"', 'Content-Length': '9' if kind == 'length' else '3'})
                with self.assertRaises(Exception):
                    b.backup_images(target, self.client(opener))
                self.assertFalse((target / 'images-manifest.json').exists())
                self.assertFalse((target / 'manifest.json').exists())

    def test_shell_propagates_cli_failure_and_no_images_is_explicit(self):
        sandbox = self.folder / 'sandbox'
        (sandbox / 'scripts').mkdir(parents=True)
        for name in ['backup-cloudflare.sh', 'cloudflare-backup.py']:
            shutil.copy(ROOT / 'scripts' / name, sandbox / 'scripts' / name)
        (sandbox / 'wrangler.toml').write_text('name="fixture"')
        (sandbox / 'wrangler.prod.toml').write_text('name="owner-fixture"')
        binary = self.folder / 'bin'
        binary.mkdir()
        npx = binary / 'npx'
        npx.write_text('#!/bin/sh\nexit 17\n')
        npx.chmod(0o700)
        env = {**os.environ, 'PATH': str(binary) + ':' + os.environ['PATH'], 'CLOUDFLARE_ACCOUNT_ID': 'e35d5918c507bc2cf4e920fe38b5e318', 'CLOUDFLARE_API_TOKEN': 'fixture-token', 'R2_ACCESS_KEY_ID': '', 'R2_SECRET_ACCESS_KEY': ''}
        retired = subprocess.run(['bash', str(sandbox / 'scripts/backup-cloudflare.sh'), '--no-images'], env={**env, 'CLOUDFLARE_ACCOUNT_ID': '844bc687926c910d5ad9d79c40ad1f2f'}, capture_output=True, text=True)
        self.assertNotEqual(retired.returncode, 0)
        self.assertIn('retired', retired.stderr)
        self.assertFalse(list(sandbox.glob('d1/backups/*')))
        missing = subprocess.run(['bash', str(sandbox / 'scripts/backup-cloudflare.sh'), '--prod'], env=env, capture_output=True, text=True)
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn('requires explicit R2', missing.stderr)
        failed = subprocess.run(['bash', str(sandbox / 'scripts/backup-cloudflare.sh'), '--prod', '--no-images'], env=env, capture_output=True, text=True)
        self.assertEqual(failed.returncode, 17)
        self.assertNotIn('backup verified', failed.stdout)
        self.assertIn('incomplete folder', failed.stderr)
        self.assertFalse(list(sandbox.glob('d1/backups/*/manifest.json')))
        self.database()
        payload = {name: (self.folder / name).read_text() for name in ['database.sql', 'counts-before.json', 'schema-before.json']}
        fake = "#!/usr/bin/env python3\nimport sys,json,pathlib\npayload=" + repr(payload) + "\nargs=sys.argv\n"
        fake += "if 'export' in args:\n out=next(a.split('=',1)[1] for a in args if a.startswith('--output=')); pathlib.Path(out).write_text(payload['database.sql'])\n"
        fake += "else:\n query=args[args.index('--command')+1]\n if 'AS table_name FROM sqlite_master' in query:\n  names=[r['table_name'] for r in json.loads(payload['counts-before.json'])[0]['results']]; print(json.dumps([{'success':True,'results':[{'table_name':n} for n in names]}]))\n elif 'SELECT type,name,tbl_name' in query: print(payload['schema-before.json'])\n else: print(payload['counts-before.json'])\n"
        npx.write_text(fake)
        complete = subprocess.run(['bash', str(sandbox / 'scripts/backup-cloudflare.sh'), '--prod', '--no-images'], env=env, capture_output=True, text=True)
        self.assertEqual(complete.returncode, 0, complete.stderr)
        self.assertIn('Database-only backup verified. Images were explicitly omitted.', complete.stdout)
        manifests = list(sandbox.glob('d1/backups/*/manifest.json'))
        self.assertEqual(len(manifests), 1)
        self.assertEqual(json.loads(manifests[0].read_text())['scope'], 'database-only')
        self.assertEqual(manifests[0].stat().st_mode & 0o077, 0)



if __name__ == '__main__':
    unittest.main()
