"""Builds a stand-in public capture from the committed snapshot, for tests only.

It has the shape of a real capture (manifest, hashes, dynamic images) but is NOT the
owner-confirmed public data and has no reviews. Never treat its output as a real import.
"""
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def build(capture):
    capture = pathlib.Path(capture)
    snapshot = json.loads((ROOT / 'src/content/content-snapshot.json').read_text())
    payloads = {
        'products': {'products': snapshot['products']},
        'categories': {'categories': snapshot['categories'], 'aliases': snapshot['categoryAliases']},
        'content': snapshot['content'],
    }
    capture.mkdir()
    manifest = {'source': 'STAND-IN built from the committed snapshot (not the public site)',
                'counts': {'products': 34, 'choices': 76}, 'endpoints': {}}
    for name, value in payloads.items():
        data = json.dumps(value).encode()
        (capture / (name + '.json')).write_bytes(data)
        manifest['endpoints'][name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    (capture / 'dynamic-images').mkdir()
    manifest['dynamicImages'] = []
    for path in sorted({p for c in snapshot['products'] for p in c['images'] if p.startswith('/api/images/')}):
        name = pathlib.PurePosixPath(path).name
        data = b'\x89PNG\r\n\x1a\n' + name.encode()
        (capture / 'dynamic-images' / name).write_bytes(data)
        manifest['dynamicImages'].append({'publicPath': path, 'filename': name,
                                          'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
    (capture / 'manifest.json').write_text(json.dumps(manifest))
    return capture
