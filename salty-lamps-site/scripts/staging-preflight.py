#!/usr/bin/env python3
"""Fail closed before any owner-account sandbox publication or database write."""
import os
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'e35d5918c507bc2cf4e920fe38b5e318'
PRODUCTION_DB = '4637fb18-2b0a-498d-b6c0-a90d6e50d3f4'
STAGING_DB = '981a6d7b-8eb7-4057-8023-d2a4894c21e4'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(config, environment):
    require(config.get('name') == 'salty-lamps-staging', 'Unexpected Pages project')
    require(config.get('account_id') == OWNER, 'Unexpected Cloudflare account')
    require(config.get('d1_databases') == [{
        'binding': 'DB', 'database_name': 'salty-lamps-staging-db',
        'database_id': STAGING_DB,
    }], 'Unexpected database binding')
    require(config['d1_databases'][0]['database_id'] != PRODUCTION_DB, 'Production database is forbidden')
    require('r2_buckets' not in config, 'R2 must stay disabled')
    vars_ = config['vars']
    require(vars_.get('STRIPE_TEST_ONLY') == '1', 'Sandbox mode is required')
    require(vars_.get('MAIL_DRY_RUN') == 'true', 'Mail dry run is required')
    require(vars_.get('SITE_URL') == 'https://test.saltylamps.co.uk', 'Unexpected staging URL')
    require(vars_.get('PUBLIC_HOST') == 'www.saltylamps.co.uk', 'Customer domain must remain canonical')
    require(vars_.get('ADMIN_HOSTS') == 'admin.saltylamps.co.uk', 'Unexpected admin host')
    require(vars_.get('ACCESS_AUD') and vars_.get('ACCESS_TEAM_DOMAIN'), 'Admin Access is required')
    for name in ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'):
        require(name not in vars_, 'Stripe keys must be encrypted secrets')
        supplied = environment.get(name, '')
        allowed = ('sk_test_', 'rk_test_') if name.endswith('SECRET_KEY') else ('pk_test_',)
        require(not supplied or supplied.startswith(allowed), 'Live Stripe key is forbidden')
    require(not environment.get('RESEND_API_KEY'), 'Customer email must remain disabled')
    require(not environment.get('R2_BUCKET'), 'R2 must remain disabled')
    require(not environment.get('DEV_ADMIN_BYPASS'), 'Admin bypass is forbidden')
    require(not environment.get('ADMIN_OPEN_HOSTS'), 'Open admin host is forbidden')
    require(environment.get('CLOUDFLARE_ACCOUNT_ID', OWNER) == OWNER, 'Unexpected Cloudflare account')
    return True


if __name__ == '__main__':
    with (ROOT / 'wrangler.staging.toml').open('rb') as stream:
        config = tomllib.load(stream)
    validate(config, os.environ)
    print('Staging target is isolated, sandbox-only, mail-dry-run, and has no R2 binding.')
