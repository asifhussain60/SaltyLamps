#!/usr/bin/env python3
"""Read-only recapture of the owner-confirmed public preview catalogue.

Only anonymous GETs of the four public JSON endpoints and the public dynamic
gallery images they reference. No credentials, admin paths or dashboards.
Each endpoint is fetched twice; differing bytes abort the capture. The output
folder is the input of scripts/rehearse-public-catalogue.py and is public data
only: it is NOT a database export or a migration backup.

    python3 scripts/capture-public-preview.py <new-folder-outside-the-repo>

CAPTURE_BASE overrides the source (used to test against a local server).
"""
import datetime
import hashlib
import json
import os
import pathlib
import sys
import urllib.request

BASE = os.environ.get('CAPTURE_BASE', 'https://salty-lamps-proposal.pages.dev').rstrip('/')
ENDPOINTS = {'products': '/api/products', 'categories': '/api/categories',
             'content': '/api/content', 'reviews': '/api/reviews'}


def get(path):
    req = urllib.request.Request(BASE + path, headers={'User-Agent': 'salty-lamps-readonly-capture',
                                                       'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=60) as res:
        if res.status != 200:
            raise SystemExit(f'{path}: HTTP {res.status}')
        return res.read(), res.headers.get('Content-Type', '')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main(out):
    out = pathlib.Path(out)
    if out.exists():
        raise SystemExit('Output exists; refusing to overwrite')
    out.mkdir(parents=True)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest = {'source': BASE, 'capturedAt': started, 'readOnly': True, 'endpoints': {}, 'dynamicImages': []}
    payloads = {}
    for name, path in ENDPOINTS.items():
        first, ctype = get(path)
        second, _ = get(path)
        if first != second:
            raise SystemExit(f'{name} changed between two reads; capture aborted')
        (out / f'{name}.json').write_bytes(first)
        manifest['endpoints'][name] = {'url': BASE + path, 'sha256': sha(first), 'bytes': len(first),
                                       'contentType': ctype, 'repeatReadIdentical': True}
        payloads[name] = json.loads(first)
    cards = payloads['products']['products']
    paths = sorted({p for c in cards for p in [c['image'], *c['images']] if p})
    dynamic = [p for p in paths if p.startswith('/api/images/')]
    (out / 'dynamic-images').mkdir()
    for path in dynamic:
        data, ctype = get(path)
        name = pathlib.PurePosixPath(path).name
        (out / 'dynamic-images' / name).write_bytes(data)
        manifest['dynamicImages'].append({'publicPath': path, 'filename': name, 'bytes': len(data),
                                          'sha256': sha(data), 'contentType': ctype})
    reviews = payloads['reviews'].get('reviews', payloads['reviews'])
    manifest['counts'] = {
        'products': len({c['productId'] for c in cards}), 'choices': len(cards),
        'categories': len(payloads['categories']['categories']),
        'collections': len(payloads['content'].get('collections', [])),
        'publishedReviews': len(reviews), 'imagePaths': len(paths), 'dynamicImages': len(dynamic),
    }
    manifest['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'counts': manifest['counts'],
                      'hashes': {k: v['sha256'] for k, v in manifest['endpoints'].items()},
                      'bytes': {k: v['bytes'] for k, v in manifest['endpoints'].items()},
                      'dynamicImages': [(i['filename'], i['bytes'], i['sha256']) for i in manifest['dynamicImages']]},
                     indent=2))


if __name__ == '__main__':
    main(sys.argv[1])
