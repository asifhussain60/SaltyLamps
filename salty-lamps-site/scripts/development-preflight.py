#!/usr/bin/env python3
"""Fail closed if development could touch the live shop or accept real payments."""
import os
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'e35d5918c507bc2cf4e920fe38b5e318'
DEV_DB = '62066199-f4b8-4026-8dd2-b56a10cd975d'


def validate(config, environment):
    def require(ok, message):
        if not ok:
            raise ValueError(message)
    require(config.get('account_id') == OWNER, 'Development must use the owner account')
    require(config.get('name') == 'salty-lamps-development', 'Unexpected development project')
    require(config.get('d1_databases') == [{'binding': 'DB', 'database_name': 'salty-lamps-development-db',
                                         'database_id': DEV_DB}], 'Development database must be isolated')
    require(config.get('r2_buckets') == [{'binding': 'IMAGES', 'bucket_name': 'salty-lamps-development-images'}],
            'Development images must be isolated')
    vars_ = config.get('vars', {})
    expected = {'DEPLOYMENT_ENV': 'development', 'STRIPE_TEST_ONLY': '1', 'MAIL_DRY_RUN': 'true', 'SITE_URL': 'https://test.saltylamps.co.uk',
                'PUBLIC_HOST': 'www.saltylamps.co.uk', 'ADMIN_HOSTS': 'test.saltylamps.co.uk',
                'DEVELOPMENT_SHARED_HOST': 'test.saltylamps.co.uk',
                'ACCESS_AUD': '72d903a62fcd255a453d435e0564c1da117166a099489adb273e4768b0822957',
                'ACCESS_TEAM_DOMAIN': 'steep-voice-d86f.cloudflareaccess.com'}
    require(vars_ == expected, 'Development safety and Access settings must match the pinned configuration')
    require(environment.get('CLOUDFLARE_ACCOUNT_ID', OWNER) == OWNER, 'Unexpected account in shell')
    for key in ('DEV_ADMIN_BYPASS', 'ADMIN_OPEN_HOSTS'):
        require(not environment.get(key), 'Deployed authentication bypass is forbidden')
    require(not environment.get('RESEND_API_KEY'), 'Development cannot use a sending credential')
    for key, prefix in [('STRIPE_SECRET_KEY', ('sk_test_', 'rk_test_')), ('STRIPE_PUBLISHABLE_KEY', ('pk_test_',))]:
        require(not environment.get(key) or environment[key].startswith(prefix), 'Live payment keys are forbidden in development')
    return True


if __name__ == '__main__':
    validate(tomllib.loads((ROOT / 'wrangler.development.toml').read_text()), os.environ)
    print('Development target verified: separate database and images, sandbox payments, mail dry-run, Access required.')
