#!/usr/bin/env python3
"""Prepares (never applies) the production import file from a public-catalogue rehearsal.

Input is the folder written by scripts/rehearse-public-catalogue.py (report.json and
rehearsal.sqlite). Output is a NEW folder holding production-import.sql and a
manifest.json. This script is offline: it opens the rehearsal read-only, connects to
no database and no account, and reads no credentials.

Nothing here authorises a production write. The manifest says so
(authorizedToApply: false) and lists the gates that are still open. Applying the
file is a separate, owner-approved step (see docs/continuation-status-2026-09-29.md).

It refuses, rather than warns, when the rehearsal contains anything that must not
reach production: orders, checkout or email records, postcodes, Wix or staging tables,
synthetic sandbox shipping, or any reference to the retired account. It then proves the
file by restoring it into an empty database and comparing every table's rows.

    python3 scripts/prepare-production-import.py --rehearsal <folder> --output <new folder>
                                                 [--verify-local-d1]

--verify-local-d1 additionally executes the file into a throwaway LOCAL D1 with the
repository's Wrangler (no remote flag, no credentials passed) and reads the counts back.
"""

import argparse
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import tomllib
from importlib.machinery import SourceFileLoader

ROOT = pathlib.Path(__file__).resolve().parent.parent
planner = SourceFileLoader('migration_planner', str(ROOT / 'scripts/plan-production-migrations.py')).load_module()

OWNER_ACCOUNT = 'e35d5918c507bc2cf4e920fe38b5e318'
PRODUCTION_DB = '4637fb18-2b0a-498d-b6c0-a90d6e50d3f4'
FORBIDDEN_TEXT = ('844bc687926c910d5ad9d79c40ad1f2f', 'e8e40717-628d-481d-9175-e9c473620125',
                  'asifhussain60@hotmail.com', 'salty-lamps-proposal')
# Cloudflare D1 rejects a single statement over 100,000 bytes.
MAX_STATEMENT_BYTES = 100_000
# Runtime records the import must never carry. Empty in a rehearsal; refuse if not.
RUNTIME_TABLES = ('orders', 'order_items', 'order_postage', 'order_item_weights', 'order_refunds',
                  'order_refund_records', 'order_notification_jobs', 'checkout_attempts',
                  'checkout_reservations', 'checkout_reservation_items', 'commerce_email_jobs',
                  'commerce_email_envelopes', 'commerce_email_reconciliations', 'email_outbox',
                  'enquiries', 'admin_audit', 'admin_save_requests', 'uk_postcodes')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def table_names(db):
    return [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]


def table_digest(db, name):
    rows = sorted(repr(tuple(r)) for r in db.execute(f'SELECT * FROM "{name}"'))
    return len(rows), sha('\n'.join(rows).encode())


def refuse_unsafe_content(db, migrations):
    problems = []
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        problems.append('The rehearsal database fails its integrity check.')
    if list(db.execute('PRAGMA foreign_key_check')):
        problems.append('The rehearsal database has foreign-key violations.')
    for name in table_names(db):
        if name.startswith(('wix_', 'staging_')):
            problems.append(f'Table {name} belongs to the Wix archive or the test shop, not production.')
    for name in RUNTIME_TABLES:
        if name in table_names(db) and db.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]:
            problems.append(f'{name} holds rows; runtime, order and postcode data must not be imported.')
    if db.execute("SELECT count(*) FROM sku_weights WHERE postal_group='sandbox'").fetchone()[0]:
        problems.append('Synthetic sandbox shipping weights are present.')
    if db.execute("SELECT count(*) FROM settings WHERE value LIKE '%Sandbox test delivery%'").fetchone()[0]:
        problems.append('A sandbox delivery rate is present in settings.')
    if db.execute("SELECT count(*) FROM settings WHERE key='email_enabled' AND value<>'0'").fetchone()[0]:
        problems.append('Email sending is enabled in the rehearsal; production must start with it off.')
    ledger = dict(db.execute('SELECT name,status FROM production_migration_ledger'))
    if len(ledger) != len(migrations) or set(ledger.values()) != {'applied'}:
        problems.append('The migration ledger is incomplete.')
    return problems


def prepare(rehearsal, output, verify_local_d1=False):
    rehearsal, output = pathlib.Path(rehearsal).resolve(), pathlib.Path(output).resolve()
    if output.exists():
        raise ValueError('Output exists; refusing to overwrite a prior preparation.')
    if output == ROOT or ROOT in output.parents:
        raise ValueError('The output must be outside the repository: it holds a full copy of the catalogue.')
    report_path, sqlite_path = rehearsal / 'report.json', rehearsal / 'rehearsal.sqlite'
    if not report_path.is_file() or not sqlite_path.is_file():
        raise ValueError('The rehearsal folder needs report.json and rehearsal.sqlite.')
    report = json.loads(report_path.read_text())
    migrations = sorted((ROOT / 'd1/migrations').glob('*.sql'))
    if report.get('migrationsApplied') != len(migrations) or not report.get('foreignKeysValid'):
        raise ValueError('report.json does not describe a rehearsal of the current migrations.')

    with open(ROOT / 'wrangler.prod.toml', 'rb') as stream:
        target = tomllib.load(stream)
    if target.get('account_id') != OWNER_ACCOUNT or target['d1_databases'][0]['database_id'] != PRODUCTION_DB:
        raise ValueError('wrangler.prod.toml no longer pins the owner account and its production database.')

    source = sqlite3.connect(f'file:{sqlite_path}?mode=ro', uri=True)
    problems = refuse_unsafe_content(source, migrations)
    if problems:
        raise ValueError('Refusing to prepare an import:\n  - ' + '\n  - '.join(problems))

    dump = planner.bootstrap_dump(source)
    for text in FORBIDDEN_TEXT:
        if text in dump:
            raise ValueError(f'The dump references the retired account ({text[:8]}...). Refusing.')
    statements = list(planner.statements(dump))
    largest = max(len(s.encode()) for s in statements)
    if largest > MAX_STATEMENT_BYTES:
        raise ValueError(f'A statement is {largest} bytes; D1 accepts at most {MAX_STATEMENT_BYTES}.')

    # Prove the file, not the source: restore it into an empty database and compare.
    restored = sqlite3.connect(':memory:')
    restored.execute('PRAGMA foreign_keys=ON')
    restored.executescript(dump)
    if list(restored.execute('PRAGMA foreign_key_check')):
        raise ValueError('The restored import has foreign-key violations.')
    tables = {}
    for name in table_names(source):
        if name not in table_names(restored):
            raise ValueError(f'Table {name} is missing from the restored import.')
        want, got = table_digest(source, name), table_digest(restored, name)
        if want != got:
            raise ValueError(f'Table {name} differs after restore: {want[0]} rows became {got[0]}.')
        tables[name] = {'rows': got[0], 'contentSha256': got[1]}
    sequences = dict(restored.execute('SELECT name,seq FROM sqlite_sequence'))
    if sequences != dict(source.execute('SELECT name,seq FROM sqlite_sequence')):
        raise ValueError('Autoincrement counters were not preserved; new ids could collide with imported ones.')

    restored.close()
    dynamic = [r[0] for r in source.execute("SELECT path FROM product_images WHERE path LIKE '/api/images/%' ORDER BY path")]
    reviews_shown = source.execute('SELECT count(*) FROM reviews WHERE display=1').fetchone()[0]
    reviews_total = source.execute('SELECT count(*) FROM reviews').fetchone()[0]
    unknown_weights = source.execute('SELECT count(*) FROM sku_weights WHERE packed_weight_g IS NULL').fetchone()[0]
    options = source.execute('SELECT count(*) FROM skus').fetchone()[0]
    header = (
        '-- SALTY LAMPS PRODUCTION IMPORT: PREPARED, NOT AUTHORISED TO APPLY.\n'
        f'-- Target: owner account {OWNER_ACCOUNT}, database {PRODUCTION_DB} (must be EMPTY: CREATE TABLE fails otherwise).\n'
        '-- Built from a public-catalogue rehearsal. It holds no orders, customers, postcodes, sandbox values or\n'
        '-- provider settings. Every packed shipping weight is unknown. See manifest.json for the open gates.\n'
        '-- Take a recovery point first. D1 file import is not guaranteed atomic; restore with Time Travel if it stops.\n')
    body = header + dump
    output.mkdir(parents=True)
    sql_path = output / 'production-import.sql'
    sql_path.write_text(body)
    sql_path.chmod(0o600)
    manifest = {
        'preparedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'authorizedToApply': False,
        'target': {'accountId': OWNER_ACCOUNT, 'databaseId': PRODUCTION_DB, 'config': 'wrangler.prod.toml'},
        'source': {'capture': report.get('source'), 'endpointHashes': report.get('sourceHashes'),
                   'rehearsalSqliteSha256': sha(sqlite_path.read_bytes()),
                   'reportSha256': sha(report_path.read_bytes())},
        'file': {'name': sql_path.name, 'bytes': len(body.encode()), 'sha256': sha(body.encode()),
                 'statements': len(statements), 'largestStatementBytes': largest},
        'counts': {'visibleProducts': report.get('visibleProducts'), 'options': options,
                   'categories': report.get('categories'), 'productImages': report.get('images'),
                   'publishedReviewsVerified': report.get('publishedReviewsVerified'),
                   'reviewRowsDisplayed': reviews_shown, 'reviewRowsNotDisplayed': reviews_total - reviews_shown},
        'galleryImagesNeedingBytes': dynamic,
        'tables': tables,
        'autoincrementCounters': sequences,
        'hiddenProductsInFile': [r[0] for r in source.execute('SELECT name FROM products WHERE visible=0 ORDER BY name')],
        'settingsInheritedFromMigrations': sorted(r[0] for r in source.execute('SELECT key FROM settings')),
        'verification': {'restoredIntoEmptyDatabase': True, 'everyTableIdentical': True, 'foreignKeysValid': True,
                         'noRuntimeOrSandboxData': True, 'noRetiredAccountReference': True,
                         'localD1': 'not run' if not verify_local_d1 else 'pending'},
        'openGates': [
            f'Packed shipping weights: all {unknown_weights} of {options} options are unknown; applying this makes every option missing-postage.',
            'Actual opening stock per option, from the owner.',
            'Hidden products, settings and full admin gallery order: not in the public capture.',
            'Owner review and approval of this mapping (migration checklist item 5).',
            'Recovery point on the owner account, and owner-account image storage (R2 terms and cost decision).',
            f'{len(dynamic)} gallery image row(s) point at /api/images/ paths whose bytes are not in this file; upload the hash-verified files from the capture under the same keys or those photos will 404.',
            f'{reviews_total - reviews_shown} review row(s) are not displayed and come from the replacement shop\'s own migrations; only the {reviews_shown} displayed rows can be checked against the preview.',
            'Scoped owner-account deployment credentials; production email, payment and Access checks.',
            'Fresh Wix delta since 26 September, reconciled against this file.',
        ],
    }
    source.close()
    if verify_local_d1:
        try:
            manifest['verification']['localD1'] = verify_in_local_d1(sql_path, tables)
        except Exception:
            shutil.rmtree(output)  # never leave a half-verified preparation behind
            raise
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'manifest.json').chmod(0o600)
    return manifest


def verify_in_local_d1(sql_path, tables):
    """Run the file through the repository's Wrangler against a throwaway LOCAL D1 and count rows."""
    wrangler = ROOT / 'node_modules/.bin/wrangler'
    if not wrangler.exists():
        return 'not run: npm ci has not been run'
    env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR') if key in os.environ}
    env['WRANGLER_SEND_METRICS'] = 'false'
    with tempfile.TemporaryDirectory(prefix='salty-import-check-') as work:
        work = pathlib.Path(work)
        (work / 'wrangler.toml').write_text('name = "import-check"\ncompatibility_date = "2024-01-01"\n'
                                            '[[d1_databases]]\nbinding = "DB"\ndatabase_name = "import-check"\n'
                                            'database_id = "00000000-0000-4000-8000-0000000000cc"\n')
        common = ['--config', str(work / 'wrangler.toml'), '--persist-to', str(work / 'state')]
        run = subprocess.run([str(wrangler), 'd1', 'execute', 'DB', '--local', *common, '--file', str(sql_path)],
                             cwd=work, env=env, text=True, capture_output=True)
        if run.returncode:
            raise ValueError('Local D1 rejected the import file:\n' + (run.stdout + run.stderr)[-1500:])
        # D1 caps compound SELECTs at only a few terms, so count in small batches.
        counts, names = {}, list(tables)
        for start in range(0, len(names), 4):
            query = ' UNION ALL '.join(f"SELECT '{n}' AS t, count(*) AS c FROM \"{n}\"" for n in names[start:start + 4])
            out = subprocess.run([str(wrangler), 'd1', 'execute', 'DB', '--local', *common, '--json', '--command', query],
                                 cwd=work, env=env, text=True, capture_output=True)
            parsed = json.loads(out.stdout)
            if not isinstance(parsed, list):
                raise ValueError('Local D1 could not count rows: ' + out.stdout[:300])
            counts.update({r['t']: r['c'] for r in parsed[0]['results']})
    bad = {n: (counts.get(n), t['rows']) for n, t in tables.items() if counts.get(n) != t['rows']}
    if bad:
        raise ValueError(f'Local D1 row counts differ from the rehearsal: {bad}')
    return f'passed: executed in a throwaway local D1; all {len(tables)} tables match row for row'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--rehearsal', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--verify-local-d1', action='store_true')
    args = parser.parse_args()
    result = prepare(args.rehearsal, args.output, args.verify_local_d1)
    print(json.dumps({k: result[k] for k in ('authorizedToApply', 'counts', 'file', 'verification', 'openGates')}, indent=2))
