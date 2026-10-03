#!/usr/bin/env python3
"""Owner-account API access using the existing, verified Wrangler login. No secret output."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib
import urllib.error
import urllib.request

OWNER = 'e35d5918c507bc2cf4e920fe38b5e318'
ROOT = Path(__file__).resolve().parents[1]


def login_token():
    requested = os.environ.get('CLOUDFLARE_ACCOUNT_ID', OWNER)
    if requested != OWNER:
        raise ValueError('Only the approved owner account is allowed')
    run = subprocess.run([str(ROOT / 'node_modules/.bin/wrangler'), 'whoami', '--json'],
                         capture_output=True, text=True, check=True,
                         env={**os.environ, 'CLOUDFLARE_ACCOUNT_ID': OWNER})
    who = json.loads(run.stdout[run.stdout.index('{'):])
    if who.get('email', '').lower() not in ('saltylamps@hotmail.com', 'asifhussain60@gmail.com'):
        raise ValueError('An approved owner or administrator login is required')
    if OWNER not in {a['id'] for a in who.get('accounts', [])}:
        raise ValueError('Login does not have the approved owner account')
    if os.environ.get('CLOUDFLARE_API_TOKEN'):
        return os.environ['CLOUDFLARE_API_TOKEN']
    candidates = [Path.home() / 'Library/Preferences/.wrangler/config/default.toml',
                  Path.home() / '.config/.wrangler/config/default.toml']
    for path in candidates:
        if path.is_file():
            token = tomllib.loads(path.read_text()).get('oauth_token')
            if token:
                return token
    raise ValueError('Wrangler login is missing; run wrangler login')


class OwnerAPI:
    def __init__(self):
        self.token = login_token()

    def request(self, resource, method='GET', payload=None, raw=False):
        # This helper cannot address another Cloudflare account or unrelated service.
        if not resource.startswith(f'/accounts/{OWNER}/'):
            raise ValueError('Resource is outside the approved owner account')
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request('https://api.cloudflare.com/client/v4' + resource,
            data=data, method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            # Never print response bodies: provider errors may echo private inputs.
            raise ValueError(f'Cloudflare {method} failed with HTTP {error.code}') from None
        if raw:
            return body
        result = json.loads(body)
        if not result.get('success'):
            codes = [e.get('code') for e in result.get('errors', [])]
            raise ValueError(f'Cloudflare request failed; error codes {codes}')
        return result.get('result')


def redact(value):
    if isinstance(value, dict):
        if value.get('type') == 'secret_text':
            return {'type': 'secret_text', 'value': '[redacted]'}
        return {k: ('[redacted]' if k in ('STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY',
            'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY') else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


if __name__ == '__main__':
    try:
        resource, destination = sys.argv[1:]
        path = Path(destination).resolve()
        if ROOT.parent == path or ROOT.parent in path.parents:
            raise ValueError('Account snapshots must be saved outside the repository')
        os.umask(0o077)
        path.parent.mkdir(parents=True, exist_ok=True)
        result = OwnerAPI().request(resource)
        path.write_text(json.dumps(redact(result), indent=2) + '\n')
        print('Private owner-account metadata saved.')
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
