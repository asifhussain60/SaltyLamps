import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('postcode_plan', Path(__file__).resolve().parents[1] / 'scripts/plan-postcode-import.py')
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)


class PostcodePlanTests(unittest.TestCase):
    def source(self, root, values):
        source = root / 'source.sql'
        source.write_text(plan.PREFIX + ','.join(f"('{v.replace(' ', '')}','{v}')" for v in values) + ';\n')
        return source

    def test_budget_chunks_replay_and_existing_output_protection(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = self.source(root, ['SW1A 1AA', 'SW1A 2AA', 'ST4 3NP'])
            output = root / 'plan'
            report = plan.build(source, output, daily_budget=4, writes_per_row=2)
            self.assertEqual([c['rows'] for c in report['chunks']], [2, 1])
            self.assertTrue(report['all_chunks_replayed_without_changes'])
            self.assertEqual(report['rows'], 3)
            self.assertTrue(all(c['planned_writes'] <= 4 for c in report['chunks']))
            original = (output / 'manifest.json').read_bytes()
            with self.assertRaises(FileExistsError):
                plan.build(source, output)
            self.assertEqual((output / 'manifest.json').read_bytes(), original)

    def test_duplicate_source_cannot_produce_approved_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = self.source(root, ['SW1A 1AA', 'SW1A 1AA'])
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                plan.build(source, root / 'plan')
            self.assertFalse((root / 'plan/manifest.json').exists())

    def test_excluded_postcodes_and_unexpected_sql_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = self.source(root, ['BT1 1AA'])
            with self.assertRaisesRegex(ValueError, 'excluded'):
                list(plan.read_rows(source))
            source.write_text('DROP TABLE uk_postcodes;\n')
            with self.assertRaisesRegex(ValueError, 'Unexpected SQL'):
                list(plan.read_rows(source))


if __name__ == '__main__':
    unittest.main()
