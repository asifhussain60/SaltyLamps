import copy
import importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('development_preflight', ROOT / 'scripts/development-preflight.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DevelopmentPreflightTests(unittest.TestCase):
    def setUp(self):
        self.config = tomllib.loads((ROOT / 'wrangler.development.toml').read_text())

    def test_pinned_target_passes(self):
        self.assertTrue(module.validate(self.config, {}))

    def test_live_resources_and_missing_switches_are_refused(self):
        for mutate in (
            lambda c: c.update(name='salty-lamps-staging'),
            lambda c: c['d1_databases'][0].update(database_id='981a6d7b-8eb7-4057-8023-d2a4894c21e4'),
            lambda c: c['r2_buckets'][0].update(bucket_name='salty-lamps-images'),
            lambda c: c['vars'].update(SITE_URL='https://www.saltylamps.co.uk'),
            lambda c: c['vars'].pop('MAIL_DRY_RUN'),
            lambda c: c['vars'].pop('DEPLOYMENT_ENV'),
            lambda c: c['vars'].update(ADMIN_OPEN_HOSTS='test.saltylamps.co.uk'),
            lambda c: c['vars'].update(RESEND_API_KEY='fixture'),
        ):
            config = copy.deepcopy(self.config)
            mutate(config)
            with self.assertRaises(ValueError):
                module.validate(config, {})

    def test_live_credentials_and_other_account_in_shell_are_refused(self):
        for environment in (
            {'STRIPE_SECRET_KEY': 'sk_live_fixture'},
            {'STRIPE_PUBLISHABLE_KEY': 'pk_live_fixture'},
            {'RESEND_API_KEY': 'sending-fixture'},
            {'CLOUDFLARE_ACCOUNT_ID': 'another-account'},
            {'DEV_ADMIN_BYPASS': '1'},
        ):
            with self.assertRaises(ValueError):
                module.validate(self.config, environment)


if __name__ == '__main__':
    unittest.main()
