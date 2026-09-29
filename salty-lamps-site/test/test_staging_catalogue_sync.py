import importlib.machinery
import pathlib
import sqlite3
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import standin_capture  # noqa: E402

load = lambda file: importlib.machinery.SourceFileLoader(file.replace('-', '_'), str(ROOT / 'scripts' / (file + '.py'))).load_module()
rehearse = load('rehearse-public-catalogue')
sync = load('prepare-staging-catalogue-sync')
planner = load('plan-production-migrations')


class StagingCatalogueSyncTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        base = pathlib.Path(folder.name)
        rehearse.rehearse(standin_capture.build(base / 'capture'), base / 'rehearsal')
        self.preview = base / 'rehearsal/rehearsal.sqlite'
        self.sql, self.summary = sync.sync_sql(self.preview)
        # The test shop today: the demo seed, sandbox weights, and a paid sandbox order.
        self.shop = sqlite3.connect(':memory:')
        self.addCleanup(self.shop.close)
        planner.rehearse(self.shop, seed=True)
        self.shop.execute("INSERT INTO sku_weights(sku_id,packed_weight_g,postal_group,weight_public) "
                          "SELECT id,1000,'sandbox',0 FROM skus WHERE id NOT IN (SELECT sku_id FROM sku_weights)")
        self.shop.execute("INSERT INTO orders(id,status) VALUES('cs_test_1','paid')")
        self.order_sku = self.shop.execute('SELECT id FROM skus ORDER BY id LIMIT 1').fetchone()[0]
        self.shop.execute('INSERT INTO order_items(order_id,sku_id,quantity,unit_price_pence) VALUES(?,?,1,100)',
                          ('cs_test_1', self.order_sku))
        self.shop.execute("INSERT INTO product_images(product_id,key,path,sort_order) "
                          "SELECT id,'uploads/x','/api/images/products/x/own.png',0 FROM products LIMIT 1")
        self.shop.commit()
        self.shop.execute('PRAGMA foreign_keys=ON')

    def apply(self):
        self.shop.executescript('BEGIN;' + self.sql + 'COMMIT;')

    def preview_rows(self, query):
        db = sqlite3.connect(self.preview)
        try:
            return db.execute(query).fetchall()
        finally:
            db.close()

    def test_products_options_and_categories_match_the_preview_and_orders_survive(self):
        self.apply()
        for table, key, columns in (('products', 'id', 'name,slug,description,image,categories,tags,visible'),
                                    ('categories', 'slug', 'name,description,image,theme,sort_order,visible,is_virtual'),
                                    ('skus', 'product_id,variant_label', 'sku,price_pence,track_mode,quantity,in_stock')):
            want = sorted(self.preview_rows(f'SELECT {key},{columns} FROM {table}'), key=str)
            got = sorted(self.shop.execute(f'SELECT {key},{columns} FROM {table} WHERE ({key}) IN '
                                           f'(SELECT {key} FROM skus)' if table == 'skus' else f'SELECT {key},{columns} FROM {table}').fetchall(), key=str)
            self.assertEqual([r for r in got if r in want], want, table)
        self.assertEqual(self.shop.execute('SELECT count(*) FROM orders').fetchone()[0], 1)
        self.assertEqual(self.shop.execute('SELECT count(*) FROM order_items WHERE sku_id=?', (self.order_sku,)).fetchone()[0], 1)
        self.assertEqual(self.shop.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_every_option_can_still_be_shipped_in_the_test_shop(self):
        self.apply()
        self.assertEqual(self.shop.execute('SELECT count(*) FROM skus WHERE id NOT IN (SELECT sku_id FROM sku_weights)').fetchone()[0], 0)

    def test_admin_uploaded_photos_are_kept_and_sorted_after_the_preview_photos(self):
        self.apply()
        own = self.shop.execute("SELECT product_id,sort_order FROM product_images WHERE key='uploads/x'").fetchone()
        first = self.shop.execute('SELECT min(sort_order) FROM product_images WHERE product_id=? AND key IS NULL', (own[0],)).fetchone()[0]
        self.assertGreater(own[1], first if first is not None else -1)
        self.assertGreaterEqual(own[1], sync.UPLOAD_SHIFT)

    def snapshot(self):
        """Content, not row numbers: photos are replaced, so their ids legitimately change."""
        return [self.shop.execute(q).fetchall() for q in (
            'SELECT * FROM products ORDER BY id',
            'SELECT product_id,variant_label,sku,price_pence,in_stock FROM skus ORDER BY 1,2',
            'SELECT product_id,key,path,sort_order FROM product_images ORDER BY 1,3,2',
            'SELECT s.product_id,s.variant_label,i.path FROM sku_images l JOIN skus s ON s.id=l.sku_id '
            'JOIN product_images i ON i.id=l.image_id ORDER BY 1,2,3',
            'SELECT count(*) FROM sku_weights')]

    def test_running_it_twice_changes_nothing_more(self):
        self.apply()
        first = self.snapshot()
        self.apply()
        self.assertEqual(first, self.snapshot())

    def test_photos_whose_bytes_are_not_in_the_test_shop_are_reported_not_linked(self):
        self.assertEqual(len(self.summary['photosNeedingBytes']), 2)
        self.assertFalse(any('/api/images/' in line for line in self.sql.splitlines() if line.startswith('INSERT INTO product_images')))


if __name__ == '__main__':
    unittest.main()
