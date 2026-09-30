#!/usr/bin/env python3
"""Fail closed before the live shop configuration is published.

Mirrors staging-preflight.py, but for the opposite mode: the promoted shop must have NO
sandbox switches, must bind R2, and must name only the customer address. Checked on the
file and on the environment of the machine that runs the deploy; it never reads a secret.
"""
import os
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]
OWNER = 'e35d5918c507bc2cf4e920fe38b5e318'
PRODUCTION_DB = '4637fb18-2b0a-498d-b6c0-a90d6e50d3f4'   # reserved, empty; not the live database
LIVE_DB = '981a6d7b-8eb7-4057-8023-d2a4894c21e4'         # the promoted shop's database
PROJECT = 'salty-lamps-staging'
HOLDING_PROJECT = 'salty-lamps'
SITE = 'https://www.saltylamps.co.uk'
SANDBOX_SWITCHES = ('STRIPE_TEST_ONLY', 'MAIL_DRY_RUN', 'STAGING_IMAGE_STORAGE')
SECRET_NAMES = ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(config, environment, staging_config=None):
    require(config.get('name') == PROJECT, 'Unexpected Pages project')
    require(config.get('name') != HOLDING_PROJECT, 'The holding project must not receive the shop')
    require(config.get('account_id') == OWNER, 'Unexpected Cloudflare account')
    require(config.get('d1_databases') == [{
        'binding': 'DB', 'database_name': 'salty-lamps-staging-db', 'database_id': LIVE_DB,
    }], 'The live shop must use the promoted database')
    require(config['d1_databases'][0]['database_id'] != PRODUCTION_DB, 'The reserved empty database is not the live one')
    require(config.get('r2_buckets') == [{'binding': 'IMAGES', 'bucket_name': 'salty-lamps-images'}],
            'R2 must be bound as IMAGES to salty-lamps-images')
    vars_ = config.get('vars', {})
    for name in SANDBOX_SWITCHES:
        require(name not in vars_, f'{name} is a sandbox switch and must be absent from the live configuration')
    for name in ('DEV_ADMIN_BYPASS', 'ADMIN_OPEN_HOSTS'):
        require(name not in vars_, f'{name} is forbidden in the live configuration')
    require(vars_.get('SITE_URL') == SITE, 'SITE_URL must be the customer address')
    require(vars_.get('PUBLIC_HOST') == 'www.saltylamps.co.uk', 'PUBLIC_HOST must be the customer host')
    require(vars_.get('ADMIN_HOSTS') == 'admin.saltylamps.co.uk', 'Unexpected admin host')
    require(vars_.get('ACCESS_AUD') and vars_.get('ACCESS_TEAM_DOMAIN'), 'Admin Access is required')
    if staging_config is not None:
        for name in ('ACCESS_AUD', 'ACCESS_TEAM_DOMAIN', 'ADMIN_HOSTS'):
            require(vars_.get(name) == staging_config['vars'].get(name),
                    f'{name} must match the verified Access setup in the test configuration')
    for name in SECRET_NAMES:
        require(name not in vars_, f'{name} must be an encrypted secret, never a plain variable')
    for name in ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'):
        supplied = environment.get(name, '')
        allowed = ('sk_live_', 'rk_live_') if name.endswith('SECRET_KEY') else ('pk_live_',)
        require(not supplied or supplied.startswith(allowed), 'A test Stripe key in the environment is forbidden')
    for name in ('DEV_ADMIN_BYPASS', 'ADMIN_OPEN_HOSTS', 'STRIPE_TEST_ONLY', 'MAIL_DRY_RUN', 'STAGING_IMAGE_STORAGE'):
        require(not environment.get(name), f'{name} is set in this shell and must not be')
    require(environment.get('CLOUDFLARE_ACCOUNT_ID', OWNER) == OWNER, 'Unexpected Cloudflare account')
    return True


if __name__ == '__main__':
    with (ROOT / 'wrangler.live.toml').open('rb') as stream:
        config = tomllib.load(stream)
    with (ROOT / 'wrangler.staging.toml').open('rb') as stream:
        staging = tomllib.load(stream)
    validate(config, os.environ, staging)
    print('Live target is the promoted shop: owner account, promoted database, R2 bound, no sandbox switches, customer address only.')
