#!/usr/bin/env python3
"""Build a fresh sandbox-only shop database import from the replacement demo seed.

Never reads a Wix export, customer record, production D1 export or local payment
fixture. The output is for the separately pinned staging D1 only.
"""
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('migration_planner', ROOT / 'scripts/plan-production-migrations.py')
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


def build():
    db = sqlite3.connect(':memory:')
    planner.rehearse(db, seed=True)
    # Deliberately synthetic shipping: it allows a provider-backed checkout
    # rehearsal across UK postcodes, never a real delivery quote.
    db.executemany(
        """INSERT INTO sku_weights(sku_id, packed_weight_g, postal_group, weight_public)
           VALUES(?, 1000, 'sandbox', 0)
           ON CONFLICT(sku_id) DO UPDATE SET packed_weight_g=1000,
             postal_group='sandbox', weight_public=0""",
        [(sku_id,) for (sku_id,) in db.execute('SELECT id FROM skus')],
    )
    postage = {'unit': 'kg', 'show_cards': False, 'rates': [{
        'id': 'sandbox-sample-postcode',
        'group': 'sandbox',
        'service': 'Sandbox test delivery (no fulfilment)',
        'country': 'GB',
        'postcodes': '',
        'min_g': 0,
        'max_g': 1000000,
        'price_pence': 0,
    }]}
    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('postage_config',?)", (json.dumps(postage),))
    db.executemany('INSERT INTO uk_postcodes VALUES (?,?)', [
        ('SW1A1AA', 'SW1A 1AA'), ('SW1A2AA', 'SW1A 2AA'),
    ])
    db.commit()
    counts = {name: db.execute(f'SELECT count(*) FROM {name}').fetchone()[0]
              for name in ('products', 'skus', 'orders', 'order_items', 'checkout_attempts',
                           'commerce_email_jobs', 'uk_postcodes')}
    assert counts['products'] > 0 and counts['skus'] > 0 and counts['uk_postcodes'] == 2
    assert db.execute('SELECT count(*) FROM sku_weights WHERE packed_weight_g=1000 AND postal_group=\'sandbox\'').fetchone()[0] == counts['skus']
    assert all(counts[name] == 0 for name in ('orders', 'order_items', 'checkout_attempts', 'commerce_email_jobs'))
    assert not any(name.startswith('wix_') for (name,) in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"))
    sql = '-- STAGING DEMO DATA ONLY. Never apply to production D1.\n' + planner.bootstrap_dump(db)
    restored = sqlite3.connect(':memory:')
    restored.executescript(sql)
    assert not list(restored.execute('PRAGMA foreign_key_check'))
    for name, count in counts.items():
        assert restored.execute(f'SELECT count(*) FROM {name}').fetchone()[0] == count
    return sql, counts


if __name__ == '__main__':
    output = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
    if output is None or output.exists() or output.is_relative_to(ROOT):
        raise SystemExit('Provide a new output path outside the repository.')
    sql, counts = build()
    output.write_text(sql)
    output.chmod(0o600)
    print('Fresh staging bootstrap prepared; no orders or Wix archive data.')
    print(counts)
