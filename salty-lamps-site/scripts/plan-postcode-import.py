#!/usr/bin/env python3
"""Measure and split a captured postcode SQL file locally. Never calls Cloudflare.

Creates a new output directory, a complete rehearsal database and hashed daily
chunks. Daily budgets are planning assumptions until remote write usage is read.
"""
import argparse
from contextlib import closing
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'INSERT OR REPLACE INTO uk_postcodes (postcode_key, postcode) VALUES '
VALUE = re.compile(r"\('([A-Z0-9]+)','([A-Z0-9 ]+)'\)")
POSTCODE = re.compile(r'^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$|^GIR 0AA$')


def read_rows(source):
    with source.open() as handle:
        for line in handle:
            if not line.startswith(PREFIX) or not line.endswith(';\n'):
                raise ValueError('Unexpected SQL; use the captured postcode generator output.')
            body = line[len(PREFIX):-2]
            pairs = VALUE.findall(body)
            if not pairs or ','.join(f"('{key}','{value}')" for key, value in pairs) != body:
                raise ValueError('Unexpected postcode values.')
            for key, value in pairs:
                if key != value.replace(' ', '') or not POSTCODE.fullmatch(value) or key.startswith('BT'):
                    raise ValueError('Invalid or excluded postcode.')
                yield key, value


def statement(rows):
    # Replaying a confirmed chunk leaves existing local rows untouched.
    # Remote write accounting must still be measured. Reconcile existing
    # conflicting values first; this plan is for a reviewed empty table only.
    return ('INSERT INTO uk_postcodes (postcode_key, postcode) VALUES '
            + ','.join(f"('{key}','{value}')" for key, value in rows)
            + ' ON CONFLICT(postcode_key) DO NOTHING;\n')


def build(source, output, daily_budget=80000, writes_per_row=2):
    if daily_budget < 1 or writes_per_row < 1 or daily_budget > 100000:
        raise ValueError('Use a positive budget at or below the Free account limit.')
    rows_per_chunk = daily_budget // writes_per_row
    if not rows_per_chunk:
        raise ValueError('Budget must permit at least one row.')
    output.mkdir(parents=True, exist_ok=False)
    with closing(sqlite3.connect(output / 'rehearsal.sqlite')) as db:
        db.executescript((ROOT / 'd1/migrations/013-uk-postcodes.sql').read_text())
        manifest = []
        chunk_rows = []
        count = 0
        max_statement = 0

        def write_chunk(rows):
            nonlocal max_statement
            name = f'chunk-{len(manifest)+1:03d}.sql'
            statements = [statement(rows[i:i+400]) for i in range(0, len(rows), 400)]
            max_statement = max(max_statement, *(len(s.encode()) for s in statements))
            if max_statement > 100000:
                raise ValueError('Statement exceeds D1 limit.')
            sql = ''.join(statements)
            (output / name).write_text(sql)
            before = db.total_changes
            db.executescript(sql)
            if db.total_changes - before != len(rows):
                raise ValueError('Duplicate source keys; source snapshot is inconsistent.')
            before = db.total_changes
            db.executescript(sql)
            if db.total_changes != before:
                raise ValueError('Chunk replay was not idempotent.')
            manifest.append({'file': name, 'sha256': hashlib.sha256(sql.encode()).hexdigest(),
                             'rows': len(rows), 'bytes': len(sql.encode()),
                             'planned_writes': len(rows)*writes_per_row, 'status': 'not_imported'})

        for row in read_rows(source):
            count += 1
            chunk_rows.append(row)
            if len(chunk_rows) == rows_per_chunk:
                write_chunk(chunk_rows)
                chunk_rows = []
        if chunk_rows:
            write_chunk(chunk_rows)
        if not count:
            raise ValueError('Empty source is not an import candidate.')
        actual = db.execute('SELECT COUNT(*) FROM uk_postcodes').fetchone()[0]
        if actual != count:
            raise ValueError('Rehearsal row count does not match the source.')
        integrity = db.execute('PRAGMA integrity_check').fetchone()[0]
        if integrity != 'ok':
            raise ValueError('Rehearsal integrity check failed.')
        query = 'SELECT postcode FROM uk_postcodes WHERE postcode_key >= ? AND postcode_key < ? ORDER BY postcode_key LIMIT 8'
        plan = db.execute('EXPLAIN QUERY PLAN ' + query, ('SW1A', 'SW1A[')).fetchall()
        samples = db.execute(query, ('SW1A', 'SW1A[')).fetchall()
        size = db.execute('PRAGMA page_count').fetchone()[0] * db.execute('PRAGMA page_size').fetchone()[0]
        report = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'rows': count, 'sql_bytes': source.stat().st_size,
                  'measured_sqlite_bytes': size, 'free_database_limit_bytes': 500000000,
                  'fits_postcode_table_alone': size < 500000000,
                  'maximum_statement_bytes': max_statement, 'daily_write_budget': daily_budget,
                  'assumed_writes_per_row': writes_per_row, 'minimum_days_one_write_per_row': math.ceil(count/100000),
                  'planned_days': len(manifest), 'chunks': manifest, 'integrity_check': integrity,
                  'all_chunks_replayed_without_changes': True, 'prefix_query_plan': plan,
                  'prefix_sample': samples, 'remote_import_performed': False,
                  'remote_write_amplification': 'unmeasured; local SQLite changes are not remote D1 billing',
                  'resume_rule': 'Verify source/chunk hashes and actual account daily usage. Apply only the next unconfirmed chunk after owner mapping/schema approval. Record remote rows_written and confirmation. After uncertain outcomes, reconcile existing keys before retry; never advance on an error. At most one planned chunk per fresh daily allowance until measured otherwise.'}
        (output / 'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
        return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = build(args.source, args.output)
    print(json.dumps({k: v for k, v in result.items() if k != 'chunks'}, indent=2))
