import copy
import importlib.util
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('live_preflight', ROOT / 'scripts/live-preflight.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def load(name):
    with (ROOT / name).open('rb') as stream:
        return tomllib.load(stream)


class LivePreflightTests(unittest.TestCase):
    def setUp(self):
        self.config = load('wrangler.live.toml')
        self.staging = load('wrangler.staging.toml')

    def check(self, env=None):
        return module.validate(self.config, env or {}, self.staging)

    def test_checked_in_live_target_passes_and_accepts_live_keys(self):
        self.assertTrue(self.check())
        self.assertTrue(self.check({'STRIPE_SECRET_KEY': 'rk_live_x', 'STRIPE_PUBLISHABLE_KEY': 'pk_live_x'}))

    def test_every_sandbox_switch_is_refused(self):
        for switch, value in (('STRIPE_TEST_ONLY', '1'), ('MAIL_DRY_RUN', 'true'), ('STAGING_IMAGE_STORAGE', 'd1')):
            config = copy.deepcopy(self.config)
            config['vars'][switch] = value
            with self.assertRaises(ValueError, msg=switch):
                module.validate(config, {}, self.staging)

    def test_photos_need_r2_or_the_shop_would_serve_none(self):
        del self.config['r2_buckets']
        with self.assertRaises(ValueError):
            self.check()

    def test_wrong_database_project_or_address_is_refused(self):
        for mutate in (
            lambda c: c['d1_databases'][0].update(database_id=module.PRODUCTION_DB),
            lambda c: c.update(name='salty-lamps'),
            lambda c: c['vars'].update(SITE_URL='https://test.saltylamps.co.uk'),
            lambda c: c['vars'].update(PUBLIC_HOST='test.saltylamps.co.uk'),
            lambda c: c['vars'].update(ACCESS_AUD='0' * 64),
            lambda c: c['vars'].update(STRIPE_SECRET_KEY='sk_live_plain_text'),
            lambda c: c['vars'].update(DEV_ADMIN_BYPASS='1'),
        ):
            config = copy.deepcopy(self.config)
            mutate(config)
            with self.assertRaises(ValueError):
                module.validate(config, {}, self.staging)

    def test_test_keys_or_sandbox_switches_in_the_shell_are_refused(self):
        for env in (
            {'STRIPE_SECRET_KEY': 'sk_test_accidental'},
            {'STRIPE_PUBLISHABLE_KEY': 'pk_test_accidental'},
            {'STRIPE_TEST_ONLY': '1'},
            {'MAIL_DRY_RUN': 'true'},
            {'CLOUDFLARE_ACCOUNT_ID': '844bc687926c910d5ad9d79c40ad1f2f'},
        ):
            with self.assertRaises(ValueError, msg=str(env)):
                self.check(env)

    def test_the_test_shop_config_is_still_sandbox_so_the_two_modes_cannot_blur(self):
        self.assertEqual(self.staging['vars']['STRIPE_TEST_ONLY'], '1')
        self.assertNotIn('r2_buckets', self.staging)


if __name__ == '__main__':
    unittest.main()
