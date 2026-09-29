import importlib.machinery
import pathlib
import tempfile
import unittest

from openpyxl import load_workbook

ROOT = pathlib.Path(__file__).resolve().parents[1]
load = lambda name: importlib.machinery.SourceFileLoader(name, str(ROOT / 'scripts' / (name + '.py'))).load_module()
build = load('build_owner_return_workbook')
hidden = load('import_hidden_products')
owner = load('import_owner_workbook')

SLUGS = {'massage and relaxation': 'himalayan-salt-massage-relaxation-products', 'salt lamps': 'salt-lamps',
         'all products': 'all-products'}


def fresh():
    folder = tempfile.TemporaryDirectory()
    path = pathlib.Path(folder.name) / 'return.xlsx'
    build.build(path)
    return folder, load_workbook(path)


def row(**values):
    base = dict.fromkeys(hidden.PREFIXES, None)
    base.update(values)
    base['row'] = base.get('row') or 2
    return base


class ReturnWorkbookTests(unittest.TestCase):
    def test_public_tab_is_read_by_the_existing_importer_and_cannot_change_prices(self):
        folder, book = fresh()
        self.addCleanup(folder.cleanup)
        rows, errors = owner.read_product_rows(book['Public products'])
        self.assertEqual((len(rows), errors), (76, []))
        self.assertEqual(min(rows), 78)
        self.assertEqual(max(rows), 156)
        # No cost or price-override header exists, so no cell on this tab can move a price.
        self.assertTrue(all(r['cost'] is None and r['override'] is None for r in rows.values()))
        self.assertTrue(all(r['stock'] is None and r['packed_weight'] is None for r in rows.values()))

    def test_bath_salt_is_prefilled_and_reads_back_as_a_hidden_product(self):
        folder, book = fresh()
        self.addCleanup(folder.cleanup)
        raw, errors = hidden.read_rows(book['Hidden products'])
        self.assertEqual(errors, [])
        products, problems = hidden.group_products(raw, SLUGS)
        self.assertEqual(problems, [])
        self.assertEqual([p['name'] for p in products], ['Himalayan Crystal Bath Salt'])
        self.assertEqual(sorted((o['code'], o['pence']) for o in products[0]['options']),
                         [('BS-10', 1699), ('BS-1000', 449), ('BS-5000', 1199)])
        body = hidden.payload(products[0], SLUGS)
        self.assertEqual(body['product']['visible'], 0)
        self.assertEqual(body['product']['categories'], 'all-products,himalayan-salt-massage-relaxation-products')
        self.assertTrue(all(o['quantity'] == 0 for o in body['skus']))  # unknown stock is never invented

    def test_request_id_is_stable_so_a_lost_response_replays(self):
        product = hidden.group_products([row(name='Lick', code='L-1', price=5, stock=3)], SLUGS)[0][0]
        self.assertEqual(hidden.payload(product, SLUGS)['requestId'], hidden.payload(product, SLUGS)['requestId'])

    def test_rejects_bad_rows(self):
        cases = {
            'price': row(name='A', code='A-1', price='abc'),
            'stock': row(name='A', code='A-1', price=1, stock='many'),
            'weight': row(name='A', code='A-1', price=1, packed_weight='heavy'),
            'code': row(name='A', price=1),
            'no name': row(code='A-1', price=1),
            'on sale word': row(name='A', code='A-1', price=1, on_sale='maybe'),
            'category': row(name='A', code='A-1', price=1, category='Nonsense'),
            'sale needs stock': row(name='A', code='A-1', price=1, on_sale='Yes'),
            'packed lighter than product': row(name='A', code='A-1', price=1, product_weight_min=1, product_weight_max=2, packed_weight=1.5),
        }
        for label, bad in cases.items():
            with self.subTest(label):
                self.assertTrue(hidden.group_products([bad], SLUGS)[1], label)
        self.assertEqual(hidden.parse_price('4.499'), None)
        self.assertEqual(hidden.parse_price('£4.49'), 449)

    def test_code_may_repeat_inside_a_product_but_not_across_products(self):
        same = [row(name='A', code='X-1', size='1Kg', price=1), row(name='A', code='X-1 (2)', size='2Kg', price=1)]
        self.assertEqual(hidden.group_products(same, SLUGS)[1], [])
        across = [row(name='A', code='X-1', price=1), row(name='B', code='X-1', price=1)]
        self.assertTrue(any('more than one product' in p for p in hidden.group_products(across, SLUGS)[1]))

    def test_existing_products_are_skipped_never_changed_and_shop_code_clashes_block(self):
        products = hidden.group_products([row(name='Himalayan Crystal Bath Salt', code='BS-1', price=1),
                                          row(name='New Thing', code='NT-1', price=1)], SLUGS)[0]
        live = [{'name': 'Himalayan Crystal Bath Salt', 'slug': 'himalayan-crystal-bath-salt', 'skus': []}]
        create, existing, problems = hidden.plan(products, live, SLUGS)
        self.assertEqual(([p['name'] for p in create], len(existing), problems), (['New Thing'], 1, []))
        live.append({'name': 'Other', 'slug': 'other', 'skus': [{'sku': 'NT-1'}]})
        self.assertTrue(hidden.plan(products, live, SLUGS)[2])

    def test_read_back_detects_a_difference(self):
        product = hidden.group_products([row(name='A', code='A-1', price=2, stock=4)], SLUGS)[0][0]
        good = [{'name': 'A', 'visible': 0, 'skus': [{'sku': 'A-1', 'variant_label': '', 'price_pence': 200, 'quantity': 4}]}]
        self.assertTrue(hidden.read_back(product, good))
        good[0]['skus'][0]['price_pence'] = 201
        self.assertFalse(hidden.read_back(product, good))

    def test_existing_importer_refuses_a_ref_that_names_a_different_product(self):
        sheet = {5: {'row': 3, 'product': 'Angel Shape Himalayan Rock Salt Lamp'}}
        self.assertEqual(owner.name_mismatches(sheet, {5: ({'name': 'Angel Shape  Himalayan Rock Salt Lamp'}, {})}), [])
        bad = owner.name_mismatches(sheet, {5: ({'name': 'Salt Shot Glass'}, {})})
        self.assertEqual(len(bad), 1)
        self.assertIn('not matched', bad[0])


if __name__ == '__main__':
    unittest.main()
