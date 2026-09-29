import importlib.machinery
import json
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
prepare = load('prepare-production-import')


def rehearsed(base):
    capture = standin_capture.build(base / 'capture')
    rehearse.rehearse(capture, base / 'rehearsal')
    return base / 'rehearsal'


class PrepareProductionImportTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.base = pathlib.Path(self.folder.name)
        self.rehearsal = rehearsed(self.base)

    def test_prepares_a_verified_file_that_is_not_authorised_to_apply(self):
        manifest = prepare.prepare(self.rehearsal, self.base / 'out')
        self.assertFalse(manifest['authorizedToApply'])
        self.assertEqual(manifest['counts']['options'], 76)
        self.assertEqual(manifest['target']['databaseId'], prepare.PRODUCTION_DB)
        self.assertTrue(any('Packed shipping weights: all 76 of 76' in g for g in manifest['openGates']))
        self.assertTrue(any('gallery image row(s) point at /api/images/' in g for g in manifest['openGates']))
        self.assertEqual(len(manifest['galleryImagesNeedingBytes']), 2)
        self.assertEqual(manifest['counts']['reviewRowsDisplayed'] + manifest['counts']['reviewRowsNotDisplayed'],
                         manifest['tables']['reviews']['rows'])
        text = (self.base / 'out/production-import.sql').read_text()
        self.assertTrue(text.startswith('-- SALTY LAMPS PRODUCTION IMPORT: PREPARED, NOT AUTHORISED TO APPLY.'))
        restored = sqlite3.connect(':memory:')
        restored.executescript(text)
        self.assertEqual(restored.execute('SELECT count(*) FROM skus').fetchone()[0], 76)
        self.assertEqual(restored.execute('SELECT count(*) FROM orders').fetchone()[0], 0)
        # New products must not reuse the preview's option ids.
        self.assertEqual(restored.execute("SELECT seq FROM sqlite_sequence WHERE name='skus'").fetchone()[0], 156)
        self.assertEqual(json.loads((self.base / 'out/manifest.json').read_text())['file']['sha256'], manifest['file']['sha256'])

    def test_refuses_to_overwrite_or_write_inside_the_repository(self):
        prepare.prepare(self.rehearsal, self.base / 'out')
        with self.assertRaisesRegex(ValueError, 'exists'):
            prepare.prepare(self.rehearsal, self.base / 'out')
        with self.assertRaisesRegex(ValueError, 'outside the repository'):
            prepare.prepare(self.rehearsal, ROOT / 'would-be-output')

    def poisoned(self, statement):
        """Apply a poisoning statement and prove it changed something, so a fixture can't pass by matching nothing."""
        db = sqlite3.connect(self.rehearsal / 'rehearsal.sqlite')
        changed = db.execute(statement).rowcount
        db.commit()
        db.close()
        self.assertNotEqual(changed, 0, f'fixture matched no rows: {statement[:60]}')

    def test_refuses_content_that_must_not_reach_production(self):
        cases = {
            'an order': "INSERT INTO orders(id,status,customer_email,amount_total_pence) VALUES('o1','paid','a@b.c',100)",
            'a postcode': "INSERT INTO uk_postcodes VALUES('SW1A1AA','SW1A 1AA')",
            'sandbox weights': "UPDATE sku_weights SET postal_group='sandbox' WHERE sku_id=(SELECT min(sku_id) FROM sku_weights)",
            'email enabled': "UPDATE settings SET value='1' WHERE key='email_enabled'",
            'a wix table': "CREATE TABLE wix_orders(id TEXT)",
        }
        for label, statement in cases.items():
            with self.subTest(label):
                folder = tempfile.TemporaryDirectory()
                self.addCleanup(folder.cleanup)
                base = pathlib.Path(folder.name)
                self.rehearsal = rehearsed(base)
                self.poisoned(statement)
                with self.assertRaisesRegex(ValueError, 'Refusing to prepare'):
                    prepare.prepare(self.rehearsal, base / 'out')

    def test_refuses_a_reference_to_the_retired_account(self):
        self.poisoned("UPDATE products SET description=description||' 844bc687926c910d5ad9d79c40ad1f2f' WHERE id=(SELECT min(id) FROM products)")
        with self.assertRaisesRegex(ValueError, 'retired account'):
            prepare.prepare(self.rehearsal, self.base / 'out')


if __name__ == '__main__':
    unittest.main()
