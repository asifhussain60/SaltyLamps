#!/usr/bin/env python3
"""Reads `wrangler pages project list --json` on stdin. Exit 0 if the named project serves
www.saltylamps.co.uk (the shop is public there), 1 if it does not, 2 if the list is unreadable.

Used by deploy-staging.sh to refuse to run once the shop is live: that script always sets
sandbox mode, so running it against the live project would silently switch real checkout
back to Stripe test mode and stop every uploaded photo being served."""
import json
import sys

WWW = 'www.saltylamps.co.uk'


def serves_www(projects, name):
    for project in projects:
        if (project.get('Project Name') or project.get('name')) == name:
            domains = project.get('Project Domains') or project.get('domains') or ''
            if isinstance(domains, str):
                domains = [part.strip() for part in domains.split(',')]
            return WWW in domains
    raise LookupError(f'project {name} not found in the list')


if __name__ == '__main__':
    text = sys.stdin.read()
    try:
        projects = None
        decoder = json.JSONDecoder()
        for start in (i for i, ch in enumerate(text) if ch == '['):   # skip any banner text before the list
            try:
                value, _ = decoder.raw_decode(text[start:])
            except ValueError:
                continue
            if isinstance(value, list):
                projects = value
                break
        if projects is None:
            raise ValueError('no JSON list in the output')
        sys.exit(0 if serves_www(projects, sys.argv[1]) else 1)
    except (ValueError, LookupError) as error:
        print(f'Could not read the Pages project list: {error}', file=sys.stderr)
        sys.exit(2)
