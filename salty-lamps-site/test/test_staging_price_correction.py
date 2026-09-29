import importlib.util
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('staging_prices', ROOT / 'scripts/prepare-staging-price-correction.py')
prices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prices)


class StagingPriceCorrectionTests(unittest.TestCase):
    def test_only_matched_old_demo_prices_are_changed(self):
        updates = prices.proposed_updates()
        self.assertEqual(len(updates), 43)
        culinary = [(label, old, new) for product, label, old, new in updates if label.endswith(('Fine', 'Coarse'))]
        self.assertEqual(len(culinary), 6)
        self.assertEqual({(old, new) for _, old, new in culinary}, {(280, 399), (280, 1199), (280, 1699)})
        self.assertNotIn('product_7e1452fd-2732-3190-c453-2a75d94db94b', {product for product, _, _, _ in updates})
        sql = prices.sql_for(updates)
        self.assertEqual(sql.count('UPDATE skus SET'), len(updates))
        self.assertIn('AND price_pence=280;', sql)
        self.assertIn('PRIVATE STAGING ONLY', sql)
        statements = [line for line in sql.splitlines() if not line.startswith('--')]
        self.assertTrue(all(line.startswith('UPDATE skus SET') for line in statements), 'D1 rejects BEGIN/COMMIT in an uploaded file')

    def test_guarded_sql_preserves_an_intervening_owner_price(self):
        planner_spec = importlib.util.spec_from_file_location('planner', ROOT / 'scripts/plan-production-migrations.py')
        planner = importlib.util.module_from_spec(planner_spec)
        planner_spec.loader.exec_module(planner)
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        planner.rehearse(db, seed=True)
        target = next(row for row in prices.proposed_updates() if row[1] == '1Kg / Fine')
        db.execute('UPDATE skus SET price_pence=450 WHERE product_id=? AND variant_label=?', target[:2])
        correction = prices.sql_for(prices.proposed_updates())
        db.executescript(correction)
        db.executescript(correction)
        self.assertEqual(db.execute('SELECT price_pence FROM skus WHERE product_id=? AND variant_label=?', target[:2]).fetchone()[0], 450)
        self.assertEqual(db.execute("SELECT price_pence FROM skus WHERE variant_label='5Kg / Coarse' AND product_id=?", (target[0],)).fetchone()[0], 1199)


if __name__ == '__main__':
    unittest.main()
