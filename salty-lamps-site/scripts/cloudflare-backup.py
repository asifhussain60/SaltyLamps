#!/usr/bin/env python3
"""Read-only backup helpers. Stdlib only. No credentials or customer rows in logs."""
import argparse
import datetime
import hashlib
import hmac
import json
import os
import pathlib
import re
import sqlite3
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def query_rows(path):
    result = json.loads(path.read_text())
    if not isinstance(result, list) or not result or any(not isinstance(item, dict) or item.get('success') is False or not isinstance(item.get('results'), list) for item in result):
        raise ValueError('Unusable D1 query response')
    return [row for item in result for row in item['results']]


def count_query(path):
    names = [row['table_name'] for row in query_rows(path)]
    if not names or len(names) != len(set(names)):
        raise ValueError('Empty or duplicate table inventory')
    # This imported reference table has 1.76M rows. A pre/post COUNT scanned
    # it twice and exhausted most of a free account's daily D1 read allowance.
    # Verify its exported copy locally and report the missing source-count check.
    names = [name for name in names if name != 'uk_postcodes']
    if not names:
        raise ValueError('No business tables available for source-count checks')
    def quote(name):
        return '"' + name.replace('"', '""') + '"'
    return '; '.join("SELECT '" + name.replace("'", "''") + "' AS table_name, COUNT(*) AS row_count FROM " + quote(name) for name in names) + ';'


def counts(path):
    rows = query_rows(path)
    result = {}
    for row in rows:
        name, count = row.get('table_name'), row.get('row_count')
        if not isinstance(name, str) or not isinstance(count, int) or count < 0 or name in result:
            raise ValueError('Invalid database row counts')
        result[name] = count
    return result


def verify_database(folder):
    before, after = counts(folder / 'counts-before.json'), counts(folder / 'counts-after.json')
    schema_before = sorted((r['type'], r['name'], r['tbl_name']) for r in query_rows(folder / 'schema-before.json'))
    schema_after = sorted((r['type'], r['name'], r['tbl_name']) for r in query_rows(folder / 'schema-after.json'))
    if schema_before != schema_after:
        raise ValueError('Database schema changed during export')
    if before != after:
        raise ValueError('Database changed during export; repeat in a maintenance window')
    source_tables = {name for kind, name, _ in schema_before if kind == 'table'}
    uncounted = sorted(source_tables - set(before))
    if uncounted not in ([], ['uk_postcodes']) or set(before) != source_tables - set(uncounted):
        raise ValueError('Source count coverage is incomplete or unexpected')
    if not {'products', 'skus', 'orders', 'order_items', 'settings', 'product_images'} <= before.keys():
        raise ValueError('Required shop tables missing from source inventory')
    if before['products'] < 1:
        raise ValueError('Shop catalog is empty; backup needs investigation')
    raw = (folder / 'database.sql').read_bytes()
    if not raw:
        raise ValueError('Empty SQL export')
    with tempfile.TemporaryDirectory(prefix='salty-restore-') as temporary:
        db = sqlite3.connect(str(pathlib.Path(temporary) / 'restore.sqlite'))
        try:
            # D1 exports can reference parents that occur later. Restore first,
            # then validate all foreign keys explicitly, without leaking rows.
            script = raw.decode('utf-8')
            # D1 exports omit a transaction. Avoid a disk sync for every row in
            # large postcode datasets, while preserving already-transactional dumps.
            if not re.search(r'(?im)^\s*(?:BEGIN(?:\s+(?:DEFERRED|IMMEDIATE|EXCLUSIVE|TRANSACTION))*|COMMIT(?:\s+TRANSACTION)?|ROLLBACK(?:\s+TRANSACTION)?)\s*;', script):
                script = 'BEGIN;\n' + script + '\nCOMMIT;'
            db.executescript(script)
            if list(db.execute('PRAGMA integrity_check')) != [('ok',)]:
                raise ValueError('Restored database integrity check failed')
            if list(db.execute('PRAGMA foreign_key_check')):
                raise ValueError('Restored database foreign-key check failed')
            restored_schema = sorted(db.execute("SELECT type,name,tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL"))
            if restored_schema != schema_before:
                raise ValueError('Restored schema objects do not match source; export may be incomplete')
            names = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")]
            restored = {name: db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0] for name in names}
            if set(restored) != source_tables or any(restored[name] != count for name, count in before.items()):
                raise ValueError('Restored table counts do not match source; export may be incomplete')
            if 'uk_postcodes' in uncounted and restored['uk_postcodes'] < 1:
                raise ValueError('Restored postcode reference table is empty')
        finally:
            db.close()
    result = {'status': 'verified', 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'rows': restored, 'source_count_unverified_tables': uncounted, 'checks': ['restore', 'integrity', 'foreign_keys', 'source_counts_before_and_after_except_listed_tables', 'source_schema_objects_before_and_after']}
    write_json(folder / 'database-manifest.json', result)
    print('Database restore verified: ' + str(len(restored)) + ' tables, ' + str(sum(restored.values())) + ' rows.' + (' Source row counts not checked for: ' + ', '.join(uncounted) + '.' if uncounted else ''))
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('R2 redirect refused')


class R2:
    def __init__(self, account, access, secret, bucket, opener=None):
        if not re.fullmatch('[a-fA-F0-9]{32}', account or '') or not access or not secret:
            raise ValueError('Explicit R2 S3 access key, secret key and Cloudflare account ID are required')
        if not re.fullmatch('[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]', bucket or ''):
            raise ValueError('Invalid R2 bucket name')
        self.host = account + '.r2.cloudflarestorage.com'
        self.access, self.secret, self.bucket = access, secret, bucket
        self.opener = opener or urllib.request.build_opener(NoRedirect()).open

    def get(self, key=None, query=None, etag=None):
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        date = timestamp[:8]
        uri = '/' + self.bucket + ('/' + urllib.parse.quote(key, safe='/~') if key is not None else '')
        encoded = sorted((urllib.parse.quote(str(k), safe='~'), urllib.parse.quote(str(v), safe='~')) for k, v in (query or {}).items())
        canonical_query = '&'.join(k + '=' + v for k, v in encoded)
        payload_hash = hashlib.sha256(b'').hexdigest()
        headers = {'host': self.host, 'x-amz-content-sha256': payload_hash, 'x-amz-date': timestamp}
        if etag is not None:
            headers['if-match'] = etag
        names = ';'.join(sorted(headers))
        canonical_headers = ''.join(k + ':' + headers[k].strip() + '\n' for k in sorted(headers))
        canonical = '\n'.join(['GET', uri, canonical_query, canonical_headers, names, payload_hash])
        scope = date + '/auto/s3/aws4_request'
        to_sign = '\n'.join(['AWS4-HMAC-SHA256', timestamp, scope, hashlib.sha256(canonical.encode()).hexdigest()])
        signing = ('AWS4' + self.secret).encode()
        for component in [date, 'auto', 's3', 'aws4_request']:
            signing = hmac.new(signing, component.encode(), hashlib.sha256).digest()
        signature = hmac.new(signing, to_sign.encode(), hashlib.sha256).hexdigest()
        headers['authorization'] = 'AWS4-HMAC-SHA256 Credential=' + self.access + '/' + scope + ', SignedHeaders=' + names + ', Signature=' + signature
        url = 'https://' + self.host + uri + ('?' + canonical_query if canonical_query else '')
        return self.opener(urllib.request.Request(url, headers=headers, method='GET'), timeout=60)

    def listing(self):
        objects, tokens, token = {}, set(), None
        while True:
            query = {'list-type': '2', 'encoding-type': 'url', 'max-keys': '1000'}
            if token:
                query['continuation-token'] = token
            with self.get(query=query) as response:
                body = response.read(16 * 1024 * 1024 + 1)
            if len(body) > 16 * 1024 * 1024:
                raise ValueError('Oversized R2 listing')
            xml = ET.fromstring(body)
            if xml.tag.split('}')[-1] != 'ListBucketResult':
                raise ValueError('Unexpected R2 listing document')
            def text(node, name):
                return node.findtext('{*}' + name)
            if text(xml, 'EncodingType') != 'url' or text(xml, 'Name') != self.bucket:
                raise ValueError('R2 listing bucket or encoding mismatch')
            entries = xml.findall('{*}Contents')
            if text(xml, 'KeyCount') != str(len(entries)):
                raise ValueError('Incomplete R2 listing page')
            for item in entries:
                encoded_key, size, etag = text(item, 'Key'), text(item, 'Size'), text(item, 'ETag')
                if encoded_key is None or not size or not size.isdigit() or not etag:
                    raise ValueError('Malformed R2 object metadata')
                key = urllib.parse.unquote(encoded_key, errors='strict')
                if not key or key in objects:
                    raise ValueError('Duplicate or empty R2 object key')
                objects[key] = {'size': int(size), 'etag': etag}
            truncated = text(xml, 'IsTruncated')
            if truncated == 'false':
                return objects
            token = text(xml, 'NextContinuationToken')
            if truncated != 'true' or not token or token in tokens:
                raise ValueError('Malformed or repeating R2 pagination')
            tokens.add(token)


def backup_images(folder, client):
    target = folder / 'images'
    target.mkdir()
    inventory = client.listing()
    manifest = []
    for key, metadata in sorted(inventory.items()):
        filename = hashlib.sha256(key.encode('utf-8')).hexdigest() + '.object'
        destination = target / filename
        size, checksum = 0, hashlib.sha256()
        with client.get(key=key, etag=metadata['etag']) as response:
            if response.headers.get('ETag') != metadata['etag'] or response.headers.get('Content-Length') != str(metadata['size']):
                raise ValueError('R2 object changed or response metadata is incomplete')
            http_metadata = {name: value for name, value in response.headers.items() if name.lower() in {'content-type', 'cache-control', 'content-disposition', 'content-encoding', 'content-language', 'expires', 'last-modified'} or name.lower().startswith('x-amz-meta-')}
            with destination.with_suffix('.part').open('xb') as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > metadata['size']:
                        raise ValueError('R2 object exceeded listed size')
                    output.write(chunk)
                    checksum.update(chunk)
        if size != metadata['size']:
            raise ValueError('R2 object download was truncated')
        destination.with_suffix('.part').rename(destination)
        manifest.append({'key': key, 'file': 'images/' + filename, 'bytes': size, 'etag': metadata['etag'], 'sha256': checksum.hexdigest(), 'http_metadata': http_metadata})
    if client.listing() != inventory:
        raise ValueError('R2 bucket changed during backup; repeat in a maintenance window')
    result = {'status': 'verified', 'bucket': client.bucket, 'count': len(manifest), 'objects': manifest}
    write_json(folder / 'images-manifest.json', result)
    print('Image backup verified: ' + str(len(manifest)) + ' objects.')
    return result


def finish(folder, images, source=None):
    database = json.loads((folder / 'database-manifest.json').read_text())
    media = json.loads((folder / 'images-manifest.json').read_text()) if images else {'status': 'omitted-explicitly'}
    if database.get('status') != 'verified' or (images and media.get('status') != 'verified'):
        raise ValueError('Backup is incomplete')
    uncounted = database.get('source_count_unverified_tables', [])
    consistency = 'Counted source tables and schema stable during capture. '
    if uncounted:
        consistency += 'Source row counts not checked for ' + ', '.join(uncounted) + '; exported rows were restored and checked locally. '
    consistency += 'Bucket inventory also verified; use a maintenance window for cross-service consistency.' if images else 'Image storage omitted; no cross-service consistency claim.'
    write_json(folder / 'manifest.json', {'status': 'complete', 'source': source or {}, 'scope': 'database-and-images' if images else 'database-only', 'database': database, 'images': media, 'consistency': consistency})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['count-query', 'verify-database', 'images', 'finish', 'finish-database-only'])
    parser.add_argument('path', type=pathlib.Path)
    parser.add_argument('--bucket', default='salty-lamps-images')
    parser.add_argument('--config')
    parser.add_argument('--database')
    args = parser.parse_args()
    if args.action == 'count-query':
        print(count_query(args.path))
    elif args.action == 'verify-database':
        verify_database(args.path)
    elif args.action == 'images':
        backup_images(args.path, R2(os.environ.get('CLOUDFLARE_ACCOUNT_ID'), os.environ.get('R2_ACCESS_KEY_ID'), os.environ.get('R2_SECRET_ACCESS_KEY'), args.bucket))
    else:
        finish(args.path, images=args.action == 'finish', source={'account': os.environ.get('CLOUDFLARE_ACCOUNT_ID', 'wrangler-login'), 'config': args.config, 'database': args.database, 'captured_at': datetime.datetime.now(datetime.timezone.utc).isoformat()})


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # HTTP errors can include object URLs; SQL errors may include imported text.
        # Log only a safe summary, leaving raw backup contents private on disk.
        print('Backup verification failed (' + type(error).__name__ + '). No complete backup manifest was issued.', file=__import__('sys').stderr)
        raise SystemExit(1)
