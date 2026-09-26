#!/usr/bin/env python3
"""Offline-only migration rehearsal. Never connects to or writes a remote database.

Fresh bootstrap: --seed --output /tmp/bootstrap.sql [--include-reviewed-media]
Existing database: --database /path/to/disposable-export.sqlite --output /tmp/upgrade.sql
Existing untracked/partially migrated databases require manual history reconciliation;
this tool deliberately cannot manufacture an adoption ledger from schema alone.
Review the plan, backup the target, apply under a maintenance window, and reconcile
remote state afterwards. Generated SQL is NOT a guarantee of atomic D1 import.
"""
import argparse
import hashlib
import pathlib
import re
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEDGER = 'production_migration_ledger'
DEFERRED = '010-lighter-catalogue.sql'


def statements(sql):
    """SQLite's parser recognises trigger bodies and quoted semicolons."""
    pending = ''
    for character in sql:
        pending += character
        if character == ';' and sqlite3.complete_statement(pending):
            yield pending
            pending = ''
    # A trailing comment is fine; an unterminated SQL statement is not.
    if re.sub(r'--[^\n]*|/\*.*?\*/', '', pending, flags=re.S).strip():
        raise ValueError('Incomplete SQL statement')


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def apply_statements(db, sql, emitted):
    for statement in statements(sql):
        try:
            db.execute(statement)
        except sqlite3.OperationalError as error:
            # Only skip an individually proven duplicate ADD COLUMN, never its file.
            clean = re.sub(r'--[^\n]*|/\*.*?\*/', '', statement, flags=re.S).strip()
            alter = re.match(r'^ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\b', clean, re.I)
            if not alter or 'duplicate column name' not in str(error).lower():
                raise
            names = {row[1] for row in db.execute('PRAGMA table_info(' + alter[1] + ')')}
            if alter[2] not in names:
                raise
        else:
            emitted.append(statement.strip())


def rehearse(db, seed=False, reviewed_media=False, root=ROOT):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    fresh = not tables
    if tables and LEDGER not in tables:
        raise ValueError('Existing database has no verified migration ledger. Stop for backup, per-migration reconciliation and reviewed adoption; never replay historical updates.')
    if seed and not fresh:
        raise ValueError('Catalog seed is allowed only on a completely empty database, even when there are no orders.')
    if not fresh and reviewed_media:
        deferred_media = db.execute('SELECT status FROM ' + LEDGER + ' WHERE name=?', (DEFERRED,)).fetchone()
        if deferred_media and deferred_media[0] == 'deferred':
            raise ValueError('Deferred media requires a separate reviewed cutover; do not apply it after later migrations or owner edits.')
    emitted = []
    if fresh:
        if not seed:
            raise ValueError('Fresh bootstrap requires explicit --seed and a reviewed source catalog.')
        apply_statements(db, (root / 'd1/schema.sql').read_text(), emitted)
        # Seed before gallery, naming and copy migrations that depend on products.
        apply_statements(db, (root / 'd1/seed.sql').read_text(), emitted)
        apply_statements(db, 'CREATE TABLE ' + LEDGER + ' (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN (\'applied\',\'deferred\')), applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')));', emitted)
    records = {r[0]: (r[1], r[2]) for r in db.execute('SELECT name,sha256,status FROM ' + LEDGER)}
    migrations = sorted((root / 'd1/migrations').glob('*.sql'))
    known = {m.name for m in migrations}
    if set(records) - known:
        raise ValueError('Ledger contains unknown migrations; use the matching application version.')
    # Check every checksum before applying anything, including a missing earlier file.
    for migration in migrations:
        record = records.get(migration.name)
        if record and record[0] != sha(migration):
            raise ValueError('Migration hash mismatch: ' + migration.name)
    for migration in migrations:
        record = records.get(migration.name)
        if record and record[1] == 'applied':
            continue
        if migration.name == DEFERRED and not reviewed_media:
            status = 'deferred'
        else:
            try:
                apply_statements(db, migration.read_text(), emitted)
            except sqlite3.Error as error:
                raise ValueError('Migration ' + migration.name + ' failed rehearsal: ' + str(error)) from error
            status = 'applied'
        if record and record[1] == status:
            continue
        ledger_sql = ('INSERT OR REPLACE INTO ' + LEDGER + ' (name,sha256,status) VALUES ('
                      + ','.join(map(literal, [migration.name, sha(migration), status])) + ');')
        apply_statements(db, ledger_sql, emitted)
    violations = list(db.execute('PRAGMA foreign_key_check'))
    if violations:
        raise ValueError('Foreign-key reconciliation failed: ' + repr(violations[:5]))
    db.commit()
    return fresh, emitted


def bootstrap_dump(db):
    # D1 resolves referenced tables when importing. Create ALL parents before data;
    # install triggers after data so the dump represents the rehearsed final state.
    objects = list(db.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name"))
    table_names = {r[1] for r in objects if r[0] == 'table'}
    dependencies = {name: {r[2] for r in db.execute('PRAGMA foreign_key_list(' + literal(name) + ')') if r[2] != name} for name in table_names}
    ordered = []
    while dependencies:
        ready = sorted(name for name, parents in dependencies.items() if not (parents & dependencies.keys()))
        if not ready:
            raise ValueError('Cyclic foreign keys need a separately reviewed import strategy.')
        ordered.extend(ready)
        for name in ready:
            del dependencies[name]
    output = [r[2] + ';' for r in objects if r[0] == 'table']
    data = [s for s in statements('\n'.join(db.iterdump())) if s.lstrip().startswith(('INSERT INTO', 'DELETE FROM'))]
    def rank(statement):
        match = re.search(r'(?:INSERT INTO|DELETE FROM) [\"]?([a-zA-Z_][a-zA-Z_0-9]*)', statement)
        if not match:
            raise ValueError('Cannot identify dump table')
        return ordered.index(match[1]) if match[1] in ordered else len(ordered)
    ledger_data = [s for s in data if ('INSERT INTO \"' + LEDGER + '\"') in s]
    output += sorted([s for s in data if s not in ledger_data], key=rank)
    output += [r[2] + ';' for r in objects if r[0] != 'table']
    # A partially imported bootstrap must never advertise completed migrations.
    output += ledger_data
    return '\n'.join(output) + '\n'


def self_test():
    db = sqlite3.connect(':memory:')
    fresh, _ = rehearse(db, seed=True)
    assert fresh
    assert db.execute('SELECT count(*) FROM product_images').fetchone()[0] > 0
    assert db.execute("SELECT count(*) FROM sqlite_master WHERE name='idx_orders_created_at'").fetchone()[0] == 1
    assert db.execute("SELECT cta_label FROM email_templates WHERE key='order_shipped'").fetchone()[0] == 'Track your parcel'
    assert db.execute("SELECT name FROM products WHERE name='Saltwood Frames'").fetchone()
    restored = sqlite3.connect(':memory:')
    restored.execute('PRAGMA foreign_keys=ON')
    restored.executescript(bootstrap_dump(db))
    assert not list(restored.execute('PRAGMA foreign_key_check'))
    # Owner changes survive a second rehearsal; historical copy corrections do not replay.
    db.execute("UPDATE products SET description='Owner amended copy'")
    db.execute("UPDATE email_templates SET cta_label='' WHERE key='order_shipped'")
    _, again = rehearse(db)
    assert not again
    assert db.execute("SELECT count(*) FROM products WHERE description<>'Owner amended copy'").fetchone()[0] == 0
    assert db.execute("SELECT cta_label FROM email_templates WHERE key='order_shipped'").fetchone()[0] == ''
    try:
        rehearse(db, seed=True)
        raise AssertionError('seed accepted non-empty database')
    except ValueError as error:
        assert 'empty' in str(error)
    partial = sqlite3.connect(':memory:')
    partial.execute('CREATE TABLE products(id TEXT)')
    try:
        rehearse(partial)
        raise AssertionError('untracked partial migration accepted')
    except ValueError as error:
        assert 'ledger' in str(error)
    # A missing later, tracked migration is executed once and then stays applied.
    db.execute("DELETE FROM production_migration_ledger WHERE name='013-uk-postcodes.sql'")
    _, pending = rehearse(db)
    assert any('uk_postcodes' in sql for sql in pending)
    assert not rehearse(db)[1]
    db.execute("UPDATE production_migration_ledger SET sha256='changed' WHERE name='006-order-despatch.sql'")
    try:
        rehearse(db)
        raise AssertionError('changed historical migration accepted')
    except ValueError as error:
        assert 'hash mismatch' in str(error)
    assert len(list(statements("CREATE TRIGGER example AFTER DELETE ON t BEGIN SELECT 1; SELECT ';'; END;"))) == 1
    print('All migration safety checks passed: bootstrap round-trip, gallery/copy/index, trigger parsing, owner edits, rerun, seed refusal, partial history, pending migration, checksum drift.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=pathlib.Path, help='Existing LOCAL SQLite export, opened read-only and copied into memory')
    parser.add_argument('--seed', action='store_true')
    parser.add_argument('--include-reviewed-media', action='store_true')
    parser.add_argument('--output', type=pathlib.Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.output:
        parser.error('--output is required')
    if args.output.exists():
        raise ValueError('Refusing to overwrite an existing plan; choose a new output path.')
    db = sqlite3.connect(':memory:')
    if args.database:
        source = sqlite3.connect(args.database.resolve().as_uri() + '?mode=ro', uri=True)
        source.backup(db)
        source.close()
    fresh, emitted = rehearse(db, seed=args.seed, reviewed_media=args.include_reviewed_media)
    sql = bootstrap_dump(db) if fresh else '\n'.join(emitted) + '\n'
    header = '-- OFFLINE REHEARSAL ONLY. Review, backup, apply under maintenance, then verify remotely.\n'
    args.output.write_text(header + sql)
    deferred = [r[0] for r in db.execute('SELECT name FROM ' + LEDGER + " WHERE status='deferred'")]
    print('Prepared ' + ('fresh bootstrap' if fresh else 'incremental plan') + '; input database untouched. Remote import atomicity and current Wix catalog require separate verification.')
    print('Deferred media migrations: ' + (', '.join(deferred) or 'none'))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Migration planning stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
