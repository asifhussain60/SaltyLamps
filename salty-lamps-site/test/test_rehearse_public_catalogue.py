"""The public-catalogue rehearsal must preserve shop fields and fail closed."""

import hashlib
import importlib.util
import json
import pathlib
import sqlite3
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts/rehearse-public-catalogue.py'
spec = importlib.util.spec_from_file_location('rehearse_public_catalogue', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PreviewRehearsalTest(unittest.TestCase):
    def test_published_reviews_match_by_identity_when_names_tie(self):
        db = sqlite3.connect(':memory:')
        db.execute('CREATE TABLE reviews(id TEXT,name TEXT,date_text TEXT,quote TEXT,proof TEXT,rating INTEGER,'
                   'featured INTEGER,display INTEGER,featured_order INTEGER)')
        db.executemany('INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,?)', [
            ('second', 'Same name', 'later', 'Second quote', '', None, 0, 1, 0),
            ('first', 'Same name', 'earlier', 'First quote', '', None, 0, 1, 0),
        ])
        source = {'reviews': [
            {'id': 'first', 'name': 'Same name', 'date': 'earlier', 'quote': 'First quote',
             'proof': '', 'rating': None, 'featured': False},
            {'id': 'second', 'name': 'Same name', 'date': 'later', 'quote': 'Second quote',
             'proof': '', 'rating': None, 'featured': False},
        ]}
        self.assertEqual(module.verify_published_reviews(db, source), 2)
        source['reviews'][0]['quote'] = 'Altered quote'
        with self.assertRaisesRegex(ValueError, 'review corpus'):
            module.verify_published_reviews(db, source)

    def test_checked_in_catalogue_rehearses_without_inventing_postage_weights(self):
        snapshot = json.loads((ROOT / 'src/content/content-snapshot.json').read_text())
        payloads = {
            'products': {'products': snapshot['products']},
            'categories': {'categories': snapshot['categories'], 'aliases': snapshot['categoryAliases']},
            'content': snapshot['content'],
        }
        with tempfile.TemporaryDirectory() as directory:
            base = pathlib.Path(directory)
            capture, output = base / 'capture', base / 'output'
            capture.mkdir()
            manifest = {'source': 'test snapshot', 'counts': {'products': 34, 'choices': 76}, 'endpoints': {}}
            for name, value in payloads.items():
                data = json.dumps(value).encode()
                (capture / (name + '.json')).write_bytes(data)
                manifest['endpoints'][name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
            media = sorted({path for card in snapshot['products'] for path in card['images']
                            if path.startswith('/api/images/')})
            (capture / 'dynamic-images').mkdir()
            manifest['dynamicImages'] = []
            for path in media:
                name = pathlib.PurePosixPath(path).name
                data = b'\x89PNG\r\n\x1a\n' + name.encode()
                (capture / 'dynamic-images' / name).write_bytes(data)
                manifest['dynamicImages'].append({'publicPath': path, 'filename': name,
                                                   'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
            (capture / 'manifest.json').write_text(json.dumps(manifest))

            report = module.rehearse(capture, output)
            self.assertEqual(report['publicCatalogFieldsVerified'], 76)
            self.assertEqual(report['migrationsApplied'], 16)
            self.assertEqual(report['packedWeightsMissing'], 76)
            self.assertEqual(report['mediaFilesVerified'], 77)
            self.assertFalse(report['importReady'])
            with self.assertRaisesRegex(ValueError, 'Output exists'):
                module.rehearse(capture, output)
            (capture / 'products.json').write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError, 'manifest'):
                module.rehearse(capture, base / 'tampered')


if __name__ == '__main__':
    unittest.main()
