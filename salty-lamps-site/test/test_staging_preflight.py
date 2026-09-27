import importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('staging_preflight', ROOT / 'scripts/staging-preflight.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StagingPreflightTests(unittest.TestCase):
    def setUp(self):
        with (ROOT / 'wrangler.staging.toml').open('rb') as stream:
            self.config = tomllib.load(stream)

    def test_checked_in_target_passes(self):
        self.assertTrue(module.validate(self.config, {}))

    def test_rejects_production_database_and_live_credentials(self):
        self.config['d1_databases'][0]['database_id'] = module.PRODUCTION_DB
        with self.assertRaises(ValueError):
            module.validate(self.config, {})
        self.config['d1_databases'][0]['database_id'] = module.STAGING_DB
        with self.assertRaises(ValueError):
            module.validate(self.config, {'STRIPE_SECRET_KEY': 'sk_live_accidental'})
        with self.assertRaises(ValueError):
            module.validate(self.config, {'RESEND_API_KEY': 'would_send_mail'})


if __name__ == '__main__':
    unittest.main()
