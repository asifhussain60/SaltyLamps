#!/usr/bin/env python3
"""Prepare guarded price updates for the private demo shop, without connecting to it.

Only variants matching both the original demo seed and the reviewed catalogue
snapshot are eligible. A changed live price will not be overwritten. The public
development preview was checked against the snapshot before this repair.
"""
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]


def proposed_updates():
    source = json.loads((ROOT / 'src/content/content-snapshot.json').read_text())['products']
    reference = {}
    for item in source:
        key = (item['productId'], (item['variantLabel'] or '').strip().casefold())
        if key in reference:
            raise ValueError(f'Ambiguous catalogue option: {key}')
        reference[key] = item

    spec = importlib.util.spec_from_file_location('migration_planner', ROOT / 'scripts/plan-production-migrations.py')
    planner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(planner)
    db = sqlite3.connect(':memory:')
    try:
        planner.rehearse(db, seed=True)
        updates = []
        for product_id, label, old_price in db.execute('SELECT product_id,variant_label,price_pence FROM skus'):
            item = reference.get((product_id, (label or '').strip().casefold()))
            if item is None:
                continue
            price = item['price']
            new_price = round(price * 100)
            if abs(price * 100 - new_price) > 0.00001:
                raise ValueError(f'Invalid pence for {product_id}: {price}')
            if new_price != old_price:
                updates.append((product_id, label, old_price, new_price))
    finally:
        db.close()
    return updates


def sql_for(updates):
    def quoted(value):
        return "'" + str(value).replace("'", "''") + "'"

    lines = [
        '-- PRIVATE STAGING ONLY. Do not apply to production or the retired account.',
        '-- Each row changes only if its current price still equals the original demo seed.',
        '-- Compare the live database and take an owner-account backup before applying.',
        'BEGIN TRANSACTION;',
    ]
    for product_id, label, old, new in updates:
        lines.append(
            f'UPDATE skus SET price_pence={new} WHERE product_id={quoted(product_id)} '
            f'AND variant_label={quoted(label)} AND price_pence={old};'
        )
    lines.append('COMMIT;')
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Provide a new output path outside the repository.')
    output = Path(sys.argv[1]).resolve()
    if output.exists() or output.is_relative_to(ROOT):
        raise SystemExit('The output must be a new file outside the repository.')
    updates = proposed_updates()
    output.write_text(sql_for(updates))
    output.chmod(0o600)
    print(f'Prepared {len(updates)} guarded private-test price updates; live prices were not changed.')
