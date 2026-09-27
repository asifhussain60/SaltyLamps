#!/usr/bin/env python3
"""Read-only postcode capacity estimate; fetch a count and one 2,000-row page.

No Cloudflare account, credential, existing database or import is used. This
sample estimate cannot replace measuring the complete candidate before import.
"""
import importlib.util
import json
import math
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def main():
    spec = importlib.util.spec_from_file_location('postcodes', ROOT / 'scripts/import-uk-postcodes.py')
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    count = source.get({'where': "PCDS NOT LIKE 'BT%'", 'returnCountOnly': 'true'})['count']
    _, values = source.page(0)
    if not values:
        raise ValueError('No sample returned; cannot estimate storage')
    db = sqlite3.connect(':memory:')
    db.executescript((ROOT / 'd1/migrations/013-uk-postcodes.sql').read_text())
    db.executemany('INSERT INTO uk_postcodes VALUES (?,?)', [(v.replace(' ', ''), v) for v in values])
    db.commit()
    size = db.execute('PRAGMA page_count').fetchone()[0] * db.execute('PRAGMA page_size').fetchone()[0]
    db.close()
    # Longest valid postcode has seven key bytes and eight displayed bytes.
    statement = 'INSERT OR REPLACE INTO uk_postcodes (postcode_key, postcode) VALUES ' + ','.join("('AA999AA','AA99 9AA')" for _ in range(400)) + ';\n'
    print(json.dumps({
        'source': source.LAYER, 'count_excluding_BT': count,
        'sample_rows': len(values), 'sample_sqlite_bytes': size,
        'projected_bytes_linear_not_full_measurement': math.ceil(size / len(values) * count),
        'maximum_statement_bytes_400_rows': len(statement.encode()),
        'limits_reviewed_date': '2026-09-27',
        'free_database_limit_bytes': 500_000_000, 'free_statement_limit_bytes': 100_000,
        'free_daily_writes': 100_000,
        'minimum_days_at_one_write_per_row': math.ceil(count / 100_000),
        'planning_days_2_writes_per_row_80000_daily_budget': math.ceil(count * 2 / 80_000),
        'production_import_performed': False,
        'exact_full_database_size_and_D1_write_amplification': 'unverified',
        'limits_source': 'https://developers.cloudflare.com/d1/platform/limits/',
        'pricing_source': 'https://developers.cloudflare.com/d1/platform/pricing/',
    }, indent=2))


if __name__ == '__main__':
    main()
