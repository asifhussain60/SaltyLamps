#!/usr/bin/env python3
"""Rehearse the owner-confirmed public catalogue against the current schema.

This is deliberately offline. The public API omits packed postage weights and
hidden/operational records, so the output is evidence, never an import file.
"""

import argparse
import collections
import decimal
import hashlib
import json
import pathlib
import re
import sqlite3
import tempfile

from importlib.machinery import SourceFileLoader

ROOT = pathlib.Path(__file__).resolve().parent.parent
planner = SourceFileLoader('migration_planner', str(ROOT / 'scripts/plan-production-migrations.py')).load_module()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def slugify(value):
    return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', value.lower()))


def read_capture(folder):
    manifest = json.loads((folder / 'manifest.json').read_text())
    sources = {}
    for name in ('products', 'categories', 'content'):
        data = (folder / (name + '.json')).read_bytes()
        expected = manifest['endpoints'][name]
        if sha(data) != expected['sha256'] or len(data) != expected['bytes']:
            raise ValueError(f'{name} differs from its reviewed capture manifest')
        sources[name] = json.loads(data)
    paths = {path for card in sources['products']['products'] for path in [card['image'], *card['images']] if path}
    dynamic = set()
    for image in manifest.get('dynamicImages', []):
        path = image['publicPath']
        if path not in paths or not path.startswith('/api/images/products/') or pathlib.PurePosixPath(path).name != image['filename']:
            raise ValueError('Captured dynamic image does not belong to the reviewed catalogue')
        data = (folder / 'dynamic-images' / image['filename']).read_bytes()
        if len(data) != image['bytes'] or sha(data) != image['sha256'] or not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Dynamic image differs from its reviewed manifest')
        dynamic.add(path)
    if {p for p in paths if p.startswith('/api/images/')} != dynamic:
        raise ValueError('A dynamic public image is missing from the media manifest')
    for path in paths - dynamic:
        if not path.startswith('/media/') or not (ROOT / 'public' / path.lstrip('/')).is_file():
            raise ValueError(f'Static media asset is missing: {path}')
    return manifest, sources


def seed_catalogue(cards):
    groups = collections.OrderedDict()
    seen_skus = set()
    for card in cards:
        groups.setdefault(card['productId'], []).append(card)
        if card['skuId'] in seen_skus or card['id'] != f"sku-{card['skuId']}":
            raise ValueError('Duplicate or inconsistent option identity')
        seen_skus.add(card['skuId'])
    statements = []
    for product_id, options in groups.items():
        first = options[0]
        variant = slugify(first['variantLabel']) if first['variantLabel'] else ''
        suffix = '-' + variant if variant else ''
        slug = first['slug'][:-len(suffix)] if suffix and first['slug'].endswith(suffix) else first['slug']
        if not slug or any((slug + ('-' + slugify(o['variantLabel']) if o['variantLabel'] else '')) != o['slug'] for o in options):
            raise ValueError(f'Option slugs do not resolve to one product: {product_id}')
        for field in ('productName', 'description', 'categories', 'tags'):
            if any(o[field] != first[field] for o in options):
                raise ValueError(f'Conflicting {field} within product {product_id}')
        fields = [product_id, first['productName'], slug, first['description'], first['image'],
                  ','.join(first['categories']), ','.join(first['tags'])]
        statements.append('INSERT INTO products(id,name,slug,description,image,categories,tags) VALUES (' + ','.join(map(planner.literal, fields)) + ');')
        for option in options:
            pennies = decimal.Decimal(str(option['price'])) * 100
            if pennies != pennies.to_integral_value() or pennies < 0:
                raise ValueError(f'Invalid price for {option["skuId"]}')
            if option['trackMode'] not in ('quantity', 'binary'):
                raise ValueError(f'Invalid stock mode for {option["skuId"]}')
            if option['trackMode'] == 'quantity' and (type(option['stockQty']) is not int or option['stock'] != (option['stockQty'] > 0)):
                raise ValueError(f'Inconsistent stock for {option["skuId"]}')
            values = [option['skuId'], option['sku'], product_id, option['variantLabel'], int(pennies),
                      option['trackMode'], option['stockQty'], int(option['stock'])]
            statements.append('INSERT INTO skus(id,sku,product_id,variant_label,price_pence,track_mode,quantity,in_stock) VALUES ('
                              + ','.join('NULL' if v is None else planner.literal(v) for v in values) + ');')
    return groups, '\n'.join(statements) + '\n'


def reconcile_public(db, groups, categories):
    # Historical migrations may update copy/images. Put current public values back
    # after their one-time effects and preserve the complete migration ledger.
    db.execute('DELETE FROM sku_images')
    db.execute('DELETE FROM product_images')
    for product_id, options in groups.items():
        first = options[0]
        db.execute('UPDATE products SET name=?, description=?, image=?, categories=?, tags=? WHERE id=?',
                   (first['productName'], first['description'], first['image'], ','.join(first['categories']),
                    ','.join(first['tags']), product_id))
        paths = list(dict.fromkeys(path for option in options for path in [option['image'], *option['images']] if path))
        image_ids = {}
        for order, path in enumerate(paths):
            key = path[len('/api/images/'):] if path.startswith('/api/images/') else None
            cur = db.execute('INSERT INTO product_images(product_id,key,path,sort_order) VALUES (?,?,?,?)',
                             (product_id, key, path, order))
            image_ids[path] = cur.lastrowid
        for option in options:
            db.execute('UPDATE skus SET sku=?,variant_label=?,price_pence=?,track_mode=?,quantity=?,in_stock=? WHERE id=?',
                       (option['sku'], option['variantLabel'], int(decimal.Decimal(str(option['price'])) * 100),
                        option['trackMode'], option['stockQty'], int(option['stock']), option['skuId']))
            if option['hasOptionImage']:
                db.execute('INSERT INTO sku_images(sku_id,image_id) VALUES (?,?)',
                           (option['skuId'], image_ids[option['image']]))
            db.execute('INSERT INTO sku_weights(sku_id,product_weight_min_g,product_weight_max_g) VALUES (?,?,?)',
                       (option['skuId'], option['productWeightMinG'], option['productWeightMaxG']))
    public_categories = {c['slug']: c for c in categories['categories']}
    for category in public_categories.values():
        db.execute('INSERT INTO categories(slug,name,description,image,theme,sort_order,visible,is_virtual) VALUES (?,?,?,?,?,?,1,?) '
                   'ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,image=excluded.image,'
                   'theme=excluded.theme,sort_order=excluded.sort_order,visible=1,is_virtual=excluded.is_virtual',
                   tuple(category[k] for k in ('slug','name','description','image','theme','sort_order','is_virtual')))
    db.execute('UPDATE categories SET visible=0 WHERE slug NOT IN (' + ','.join('?' for _ in public_categories) + ')',
               tuple(public_categories))
    db.execute('DELETE FROM category_aliases')
    db.executemany('INSERT INTO category_aliases(alias,slug) VALUES (?,?)', categories['aliases'].items())
    db.commit()


def verify_public_catalogue(db, cards, categories):
    """Read back the fields that the public product/category API can prove."""
    for card in cards:
        row = db.execute(
            'SELECT p.name,p.description,p.categories,p.tags,p.image,s.sku,s.variant_label,'
            's.price_pence,s.track_mode,s.quantity,s.in_stock '
            'FROM skus s JOIN products p ON p.id=s.product_id WHERE s.id=? AND p.id=?',
            (card['skuId'], card['productId'])).fetchone()
        if row is None:
            raise ValueError(f'Missing source option {card["skuId"]}')
        name, desc, cat, tags, cover, sku, label, price, mode, qty, stock = row
        expected = (card['productName'], card['description'], ','.join(card['categories']),
                    ','.join(card['tags']), card['sku'], card['variantLabel'],
                    int(decimal.Decimal(str(card['price'])) * 100), card['trackMode'], card['stockQty'], int(card['stock']))
        if (name, desc, cat, tags, sku, label, price, mode, qty, stock) != expected:
            raise ValueError(f'Product/price/stock mismatch for option {card["skuId"]}')
        assigned = db.execute('SELECT pi.id,pi.path FROM sku_images si JOIN product_images pi ON pi.id=si.image_id '
                              'WHERE si.sku_id=?', (card['skuId'],)).fetchone()
        image = assigned[1] if assigned else cover
        gallery = db.execute(
            'SELECT pi.path FROM product_images pi WHERE pi.product_id=? AND '
            '(NOT EXISTS(SELECT 1 FROM sku_images si JOIN product_images a ON a.id=si.image_id '
            'WHERE a.product_id=pi.product_id AND a.path=pi.path) OR pi.id=?) '
            'ORDER BY pi.sort_order,pi.id', (card['productId'], assigned[0] if assigned else -1)).fetchall()
        paths = list(dict.fromkeys([image, *(r[0] for r in gallery)]))
        if image != card['image'] or paths != card['images'] or bool(assigned) != card['hasOptionImage']:
            raise ValueError(f'Image/gallery mismatch for option {card["skuId"]}')
    current = db.execute('SELECT slug,name,description,image,theme,sort_order,is_virtual FROM categories '
                         'WHERE visible=1 ORDER BY sort_order,name').fetchall()
    wanted = [tuple(c[k] for k in ('slug','name','description','image','theme','sort_order','is_virtual'))
              for c in categories['categories']]
    if current != wanted:
        raise ValueError('Category metadata or order does not match source')
    aliases = dict(db.execute('SELECT alias,slug FROM category_aliases'))
    if aliases != categories['aliases']:
        raise ValueError('Category aliases do not match source')


def rehearse(capture, output):
    if output.exists():
        raise ValueError('Output exists; refusing to overwrite a prior review')
    manifest, source = read_capture(capture)
    cards = source['products']['products']
    groups, seed = seed_catalogue(cards)
    if len(groups) != manifest['counts']['products'] or len(cards) != manifest['counts']['choices']:
        raise ValueError('Capture counts changed')
    with tempfile.TemporaryDirectory(prefix='salty-preview-rehearsal-') as temporary:
        temp = pathlib.Path(temporary)
        (temp / 'd1').mkdir()
        (temp / 'd1/schema.sql').symlink_to(ROOT / 'd1/schema.sql')
        (temp / 'd1/migrations').symlink_to(ROOT / 'd1/migrations', target_is_directory=True)
        (temp / 'd1/seed.sql').write_text(seed)
        db = sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        planner.rehearse(db, seed=True, reviewed_media=True, root=temp)
    reconcile_public(db, groups, source['categories'])
    verify_public_catalogue(db, cards, source['categories'])
    if list(db.execute('PRAGMA foreign_key_check')):
        raise ValueError('Foreign-key failure after source reconciliation')
    ledger = dict(db.execute('SELECT name,status FROM production_migration_ledger'))
    if set(ledger.values()) != {'applied'} or len(ledger) != len(list((ROOT / 'd1/migrations').glob('*.sql'))):
        raise ValueError('Migration ledger incomplete')
    if db.execute('SELECT count(*) FROM skus').fetchone()[0] != len(cards):
        raise ValueError('Option count changed in migration')
    unknown_weights = db.execute('SELECT count(*) FROM sku_weights WHERE packed_weight_g IS NULL').fetchone()[0]
    if unknown_weights != len(cards):
        raise ValueError('Unknown packed weights were silently filled')
    output.mkdir(parents=True)
    target = sqlite3.connect(output / 'rehearsal.sqlite')
    db.backup(target)
    target.close()
    report = {
        'source': manifest['source'], 'sourceHashes': {k:v['sha256'] for k,v in manifest['endpoints'].items()},
        'visibleProducts': len(groups), 'choices': len(cards), 'categories': len(source['categories']['categories']),
        'images': db.execute('SELECT count(*) FROM product_images').fetchone()[0],
        'mediaFilesVerified': len({path for card in cards for path in [card['image'], *card['images']] if path}),
        'migrationsApplied': len(ledger), 'foreignKeysValid': True,
        'publicCatalogFieldsVerified': len(cards),
        'packedWeightsMissing': unknown_weights,
        'importReady': False,
        'openReview': ['Packed postage weights and current opening stock', 'Hidden products and non-public operational fields',
                       'Fresh Wix business delta', 'Owner production image storage and deployment credentials',
                       'Preserve newer collection rules and policy/review fixes while resolving content differences'],
    }
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    print(json.dumps(rehearse(args.capture, args.output), indent=2))
