#!/usr/bin/env python3
"""Prepare a catalogue-only sync of the PRIVATE TEST shop to the owner-confirmed preview.

Reads a rehearsal database made by rehearse-public-catalogue.py and writes one SQL
file. Nothing is connected to or applied. It updates in place, keyed on the stable
product id and the (product, option label) pair, so the test shop's Stripe sandbox
orders keep pointing at real options.

What it changes: products, categories, options (code, price, stock), option photos
and product galleries. What it leaves alone: orders, settings, content pages,
reviews, sandbox shipping, postcodes, hidden products that are not in the preview,
and photos uploaded through the admin (they move to the end of their gallery).
New options get the same sandbox packed weight as the rest of the test shop, so
checkout still works; the preview publishes no weights.

Not for production: the production import is a different, gated file.
"""
import argparse
import os
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
PRODUCT_COLUMNS = ('name', 'slug', 'description', 'image', 'categories', 'tags', 'visible')
CATEGORY_COLUMNS = ('name', 'description', 'image', 'theme', 'sort_order', 'visible', 'is_virtual')
SKU_COLUMNS = ('sku', 'price_pence', 'track_mode', 'quantity', 'in_stock')
UPLOAD_SHIFT = 1000


def q(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def cols(names):
    return ','.join(names)


def sync_sql(rehearsal_db):
    db = sqlite3.connect(f'file:{rehearsal_db}?mode=ro', uri=True)
    products = db.execute(f'SELECT id,{cols(PRODUCT_COLUMNS)} FROM products ORDER BY id').fetchall()
    categories = db.execute(f'SELECT slug,{cols(CATEGORY_COLUMNS)} FROM categories ORDER BY slug').fetchall()
    skus = db.execute(f'SELECT id,product_id,variant_label,{cols(SKU_COLUMNS)} FROM skus ORDER BY id').fetchall()
    images = db.execute('SELECT id,product_id,path,sort_order FROM product_images ORDER BY id').fetchall()
    links = db.execute('SELECT sku_id,image_id FROM sku_images ORDER BY sku_id').fetchall()
    db.close()
    if not products or not skus:
        raise ValueError('The rehearsal database has no catalogue.')
    keys = [(s[1], s[2]) for s in skus]
    if len(set(keys)) != len(keys):
        raise ValueError('Two preview options share a product and label; they cannot be matched safely.')

    ids = ','.join(q(p[0]) for p in products)
    lines = [
        '-- PRIVATE TEST SHOP ONLY. Catalogue sync to the owner-confirmed preview. Never production.',
        '-- Updates in place by stable product id and option label; orders, settings, content,',
        '-- reviews and shipping are not touched. Applied all-or-nothing by D1.',
    ]

    for row in products:
        pid, values = row[0], row[1:]
        sets = ','.join(f'{c}=excluded.{c}' for c in PRODUCT_COLUMNS)
        lines.append(f'INSERT INTO products(id,{cols(PRODUCT_COLUMNS)}) VALUES({q(pid)},{",".join(q(v) for v in values)}) '
                     f'ON CONFLICT(id) DO UPDATE SET {sets};')
    for row in categories:
        sets = ','.join(f'{c}=excluded.{c}' for c in CATEGORY_COLUMNS)
        lines.append(f'INSERT INTO categories(slug,{cols(CATEGORY_COLUMNS)}) VALUES({",".join(q(v) for v in row)}) '
                     f'ON CONFLICT(slug) DO UPDATE SET {sets};')

    for _, pid, label, *values in skus:
        sets = ','.join(f'{c}={q(v)}' for c, v in zip(SKU_COLUMNS, values))
        lines.append(f'UPDATE skus SET {sets} WHERE product_id={q(pid)} AND variant_label={q(label)};')
        lines.append(f'INSERT INTO skus(product_id,variant_label,{cols(SKU_COLUMNS)}) '
                     f'SELECT {q(pid)},{q(label)},{",".join(q(v) for v in values)} '
                     f'WHERE NOT EXISTS (SELECT 1 FROM skus WHERE product_id={q(pid)} AND variant_label={q(label)});')

    # Options the preview does not list. Unordered ones go; ones a test order points at
    # stay but are marked out of stock, so an order never loses its line.
    listed = ','.join(q(f'{pid}|{label}') for pid, label in keys)
    extra = f"product_id IN ({ids}) AND product_id||'|'||variant_label NOT IN ({listed})"
    lines.append(f'DELETE FROM sku_images WHERE sku_id IN (SELECT id FROM skus WHERE {extra} AND id NOT IN (SELECT sku_id FROM order_items));')
    lines.append(f'DELETE FROM sku_weights WHERE sku_id IN (SELECT id FROM skus WHERE {extra} AND id NOT IN (SELECT sku_id FROM order_items));')
    lines.append(f'DELETE FROM skus WHERE {extra} AND id NOT IN (SELECT sku_id FROM order_items);')
    lines.append(f'UPDATE skus SET in_stock=0 WHERE {extra};')
    lines.append("INSERT INTO sku_weights(sku_id,packed_weight_g,postal_group,weight_public) "
                 "SELECT id,1000,'sandbox',0 FROM skus WHERE id NOT IN (SELECT sku_id FROM sku_weights);")

    # Galleries: replace the static photos, keep admin uploads and push them after the preview's.
    lines.append(f'DELETE FROM sku_images WHERE image_id IN (SELECT id FROM product_images WHERE product_id IN ({ids}) AND key IS NULL);')
    lines.append(f'DELETE FROM product_images WHERE product_id IN ({ids}) AND key IS NULL;')
    lines.append(f'UPDATE product_images SET sort_order=sort_order+{UPLOAD_SHIFT} WHERE product_id IN ({ids}) AND key IS NOT NULL AND sort_order<{UPLOAD_SHIFT};')
    static = {i[0]: i for i in images if not i[2].startswith('/api/')}
    for _, pid, path, order in static.values():
        lines.append(f'INSERT INTO product_images(product_id,key,path,sort_order) VALUES({q(pid)},NULL,{q(path)},{order});')
    sku_by_id = {s[0]: s for s in skus}
    for sku_id, image_id in links:
        if image_id not in static:
            continue
        _, spid, label, *_rest = sku_by_id[sku_id]
        _, ipid, path, _order = static[image_id]
        lines.append('INSERT INTO sku_images(sku_id,image_id) SELECT s.id,i.id FROM skus s, product_images i '
                     f'WHERE s.product_id={q(spid)} AND s.variant_label={q(label)} '
                     f'AND i.product_id={q(ipid)} AND i.path={q(path)} AND i.key IS NULL;')
    skipped = [i for i in images if i[2].startswith('/api/')]
    return '\n'.join(lines) + '\n', {'products': len(products), 'options': len(skus), 'categories': len(categories),
                                     'galleryPhotos': len(static), 'photosNeedingBytes': [i[2] for i in skipped]}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--rehearsal', required=True, help='folder holding rehearsal.sqlite')
    parser.add_argument('--output', required=True, help='new .sql file outside the repository')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists() or output.is_relative_to(ROOT):
        sys.exit('The output must be a new file outside the repository.')
    sql, summary = sync_sql(Path(args.rehearsal) / 'rehearsal.sqlite')
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(sql)
    print(f'Prepared a test-shop catalogue sync: {summary}. Nothing was applied.')


if __name__ == '__main__':
    main()
