#!/usr/bin/env python3
"""Refuse the low-level live deploy unless its exact hosted test release is signed off."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('publish_release', ROOT / 'scripts/publish-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def main():
    if not release.RECEIPT.exists() or not release.SIGN_OFF.exists():
        raise ValueError('Publish and sign off the committed develop release before a live deployment')
    receipt = json.loads(release.RECEIPT.read_text())
    approval = json.loads(release.SIGN_OFF.read_text())
    commit = release.run(['git', 'rev-parse', 'HEAD'], capture=True).stdout.strip()
    dirty = bool(release.run(['git', 'status', '--porcelain', '--untracked-files=normal'], capture=True).stdout)
    release.validate_release(receipt, commit, release.fingerprint(release.release_files()), dirty)
    release.validate_sign_off(approval, receipt)
    api = release.load_module('cloudflare-owner').OwnerAPI()
    release.verify_test_deployment(api, receipt)
    print('Exact hosted develop release, owner acceptance and production sign-off verified.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.exit(str(error))
