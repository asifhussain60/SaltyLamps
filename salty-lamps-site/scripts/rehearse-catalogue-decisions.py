#!/usr/bin/env python3
"""Offline catalogue decision rehearsal; never a production import or deployment.

The public snapshot is a projection, not an authoritative database backup. This
builds an explicitly disposable catalogue and tests shared-stock feasibility with
the application's actual reservation trigger. It does not enable shop orientation UI.
"""
import argparse
import collections
import decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
FRAME = 'product_1984920f-d499-367d-8f0f-e622486c621a'
BATH = 'product_7e1452fd-2732-3190-c453-2a75d94db94b'
ORIENTATIONS = ('portrait', 'landscape')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def aggregate_choices(lines):
    """Separate fulfilment choices; one quantity reservation per size identity."""
    quantities = collections.Counter()
    choices = collections.Counter()
    for line in lines:
        sku, quantity, orientation = line['sku_id'], line['quantity'], line['orientation']
        if type(sku) is not int or sku < 1 or type(quantity) is not int or not 1 <= quantity <= 9999:
            raise ValueError('Invalid SKU or quantity')
        if orientation not in ORIENTATIONS:
            raise ValueError('Invalid frame orientation')
        quantities[sku] += quantity
        if quantities[sku] > 9999:
            raise ValueError('Combined quantity exceeds order limit')
        choices[sku, orientation] += quantity
    if not quantities:
        raise ValueError('Empty basket')
    return quantities, choices


def reserve(db, session, lines):
    quantities, choices = aggregate_choices(lines)
    # Exactly the same atomic reservation tables/trigger used by checkout.
    with db:
        for sku in quantities:
            if db.execute('SELECT product_id FROM skus WHERE id=?', (sku,)).fetchone() != (FRAME,):
                raise ValueError('Orientation is allowed only for the reviewed frame product')
        db.execute('INSERT INTO checkout_reservations(session_id,address_json,expires_at) VALUES(?,?,?)',
                   (session, '{}', 2000000000))
        db.executemany('INSERT INTO checkout_reservation_items(session_id,sku_id,quantity) VALUES(?,?,?)',
                       [(session, sku, quantity) for sku, quantity in quantities.items()])
        db.executemany('INSERT INTO rehearsal_frame_choices VALUES(?,?,?,?)',
                       [(session, sku, orientation, quantity) for (sku, orientation), quantity in choices.items()])
    return quantities


def prove_shared_stock(db):
    sku = db.execute('SELECT id FROM skus WHERE product_id=? ORDER BY id', (FRAME,)).fetchone()[0]
    original = db.execute('SELECT quantity FROM skus WHERE id=?', (sku,)).fetchone()[0]
    # A synthetic last-three-units fixture, restored after the evidence is captured.
    db.execute('UPDATE skus SET quantity=3 WHERE id=?', (sku,))
    db.commit()
    lines = [{'sku_id': sku, 'orientation': 'portrait', 'quantity': 2},
             {'sku_id': sku, 'orientation': 'landscape', 'quantity': 1}]
    reserve(db, 'rehearsal-first', lines)
    held = db.execute('SELECT quantity FROM checkout_reservation_items WHERE session_id=?', ('rehearsal-first',)).fetchall()
    assert held == [(3,)]
    breakdown = db.execute('SELECT orientation,quantity FROM rehearsal_frame_choices WHERE session_id=? ORDER BY orientation', ('rehearsal-first',)).fetchall()
    assert breakdown == [('landscape', 1), ('portrait', 2)]
    try:
        reserve(db, 'rehearsal-competing', [{'sku_id': sku, 'orientation': 'landscape', 'quantity': 1}])
    except sqlite3.IntegrityError as error:
        assert 'checkout_stock_unavailable' in str(error)
    else:
        raise AssertionError('Competing orientation oversold the same stock')
    assert not db.execute('SELECT 1 FROM checkout_reservations WHERE session_id=?', ('rehearsal-competing',)).fetchone()
    db.execute("UPDATE checkout_reservations SET status='released' WHERE session_id=? AND status='active'", ('rehearsal-first',))
    db.commit()
    reserve(db, 'rehearsal-second', [{'sku_id': sku, 'orientation': 'landscape', 'quantity': 3}])
    # Releasing the old checkout again must not release the new shopper's stock.
    db.execute("UPDATE checkout_reservations SET status='released' WHERE session_id=? AND status='active'", ('rehearsal-first',))
    db.commit()
    assert db.execute("SELECT SUM(i.quantity) FROM checkout_reservation_items i JOIN checkout_reservations r ON r.session_id=i.session_id WHERE r.status='active'").fetchone()[0] == 3
    evidence = {'mixed_orientation_hold': held[0][0], 'preserved_choices': breakdown,
                'competing_checkout_rejected': True, 'failed_admission_rolled_back': True,
                'released_stock_reusable': True, 'repeat_old_release_preserves_new_hold': True}
    with db:
        db.execute('DELETE FROM rehearsal_frame_choices')
        db.execute('DELETE FROM checkout_reservation_items')
        db.execute('DELETE FROM checkout_reservations')
        db.execute('UPDATE skus SET quantity=? WHERE id=?', (original, sku))
    return evidence


def rehearse(snapshot_path, local_review_path, decisions_path, output):
    if output.exists():
        raise ValueError('Output already exists; preserve the prior rehearsal')
    paths = {'public-snapshot.json': snapshot_path, 'local-review.json': local_review_path, 'owner-decisions.json': decisions_path}
    raw = {name: path.read_bytes() for name, path in paths.items()}
    snapshot = json.loads(raw['public-snapshot.json'])
    review = json.loads(raw['local-review.json'])
    decisions = json.loads(raw['owner-decisions.json'])
    if review['public_snapshot']['sha256'] != digest(raw['public-snapshot.json']):
        raise ValueError('Public snapshot changed since the local-state review')
    prices = decisions['bath_salt']['approved_rehearsal_prices_pence']
    assert prices == {'BS-1000': 449, 'BS-5000': 1199, 'BS-10': 1699}
    if decisions['wooden_frames']['stock_decision'] != 'Portrait and landscape share the same stock pool for each size':
        raise ValueError('Shared-stock decision is missing')
    hidden = [p for d in review['databases'] for p in d['products'] if p['id'] == BATH]
    # Both read-only copies must agree on existing identities; neither is adopted.
    identities = [{s['sku']: s['id'] for s in p['skus']} for p in hidden]
    if len(identities) != 2 or identities[0] != identities[1] or set(identities[0]) != set(prices):
        raise ValueError('Hidden bath-salt identities need reconciliation')
    candidate = json.loads(raw['public-snapshot.json'])
    if any(p['productId'] == BATH for p in candidate['products']):
        raise ValueError('Bath salt is already public; review rather than duplicate it')
    used = {p['skuId'] for p in candidate['products']}
    if used.intersection(identities[0].values()):
        raise ValueError('Bath-salt SKU identity collides with the public catalogue')
    for code, label in [('BS-1000', '1 kg'), ('BS-5000', '5 kg'), ('BS-10', '10 kg')]:
        # Stock is intentionally unavailable until current opening counts are approved.
        candidate['products'].append({'id': 'sku-' + str(identities[0][code]), 'skuId': identities[0][code],
            'productId': BATH, 'sku': code, 'name': 'Himalayan Crystal Bath Salt — ' + label,
            'productName': 'Himalayan Crystal Bath Salt', 'variantLabel': label,
            'slug': 'himalayan-crystal-bath-salt-' + label.replace(' ', '-'), 'price': prices[code] / 100,
            'trackMode': 'quantity', 'stock': False, 'stockQty': 0,
            'categories': ['all-products', 'himalayan-salt-massage-relaxation-products'], 'tags': [],
            'description': 'Himalayan crystal bath salt, available in 1 kg, 5 kg and 10 kg packs.',
            'image': '/media/live-site-products/bath-salt-live-site.jpg',
            'images': ['/media/live-site-products/bath-salt-live-site.jpg'],
            'productWeightMinG': None, 'productWeightMaxG': None, 'deliveryNeedsConfirmation': True})
    candidate['rehearsalOnly'] = True
    candidate['source'] = 'offline catalogue decision rehearsal; not a live source'
    candidate['sourceSnapshotSha256'] = digest(raw['public-snapshot.json'])
    candidate['frameOrderChoices'] = {'productId': FRAME, 'choices': list(ORIENTATIONS), 'stockPool': 'existing size SKU'}
    output.mkdir(parents=True)
    for name, content in raw.items():
        (output / name).write_bytes(content)
    db = sqlite3.connect(str(output / 'catalogue.sqlite'))
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript((ROOT / 'd1/schema.sql').read_text())
    reservation_sql = (ROOT / 'd1/migrations/014-commerce-safety.sql').read_text().split('-- A paid order and its notification intent', 1)[0]
    if 'checkout_protect_reserved_stock' not in reservation_sql:
        raise ValueError('Reservation schema boundary changed; review the rehearsal')
    db.executescript(reservation_sql)
    db.executescript('''CREATE TABLE rehearsal_frame_choices(
      session_id TEXT NOT NULL, sku_id INTEGER NOT NULL,
      orientation TEXT NOT NULL CHECK(orientation IN ('portrait','landscape')),
      quantity INTEGER NOT NULL CHECK(quantity>0),
      PRIMARY KEY(session_id,sku_id,orientation),
      FOREIGN KEY(session_id,sku_id) REFERENCES checkout_reservation_items(session_id,sku_id));''')
    groups = collections.defaultdict(list)
    for row in candidate['products']:
        groups[row['productId']].append(row)
    with db:
        for product_id, rows in groups.items():
            first = rows[0]
            suffix = re.sub(r'[^a-z0-9]+', '-', first['variantLabel'].lower()).strip('-')
            slug = first['slug'][:-len(suffix)-1] if suffix and first['slug'].endswith('-'+suffix) else first['slug']
            db.execute('INSERT INTO products(id,name,slug,description,image,categories,tags,visible) VALUES(?,?,?,?,?,?,?,1)',
                       (product_id, first['productName'], slug, first['description'], first['image'], ','.join(first['categories']), ','.join(first['tags'])))
            for row in rows:
                money = decimal.Decimal(str(row['price'])) * 100
                if money != money.to_integral_value():
                    raise ValueError('Price is not exact pennies')
                db.execute('INSERT INTO skus(id,sku,product_id,variant_label,price_pence,track_mode,quantity,in_stock) VALUES(?,?,?,?,?,?,?,?)',
                           (row['skuId'], row['sku'], product_id, row['variantLabel'], int(money), row['trackMode'], row['stockQty'], int(row['stock'])))
    assert len(groups) == 35 and len(candidate['products']) == 79
    assert db.execute('SELECT COUNT(*) FROM skus WHERE product_id=?', (FRAME,)).fetchone()[0] == 3
    assert candidate['products'][:len(snapshot['products'])] == snapshot['products']
    evidence = prove_shared_stock(db)
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    assert db.execute('PRAGMA integrity_check').fetchone() == ('ok',)
    spec = importlib.util.spec_from_file_location('wix_recovery', ROOT / 'scripts/rehearse-wix-import.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    sql = helper.recovery_sql(db)
    (output / 'catalogue.sql').write_text(sql)
    restored = sqlite3.connect(str(output / 'restored.sqlite'))
    restored.executescript(sql)
    assert not restored.execute('PRAGMA foreign_key_check').fetchall()
    for table in ['products', 'skus', 'checkout_reservations', 'checkout_reservation_items', 'rehearsal_frame_choices']:
        assert db.execute('SELECT * FROM '+table+' ORDER BY 1,2').fetchall() == restored.execute('SELECT * FROM '+table+' ORDER BY 1,2').fetchall()
    assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0] == 0
    (output / 'candidate-public.json').write_text(json.dumps(candidate, indent=2)+'\n')
    restored.close()
    db.close()
    for name, path in paths.items():
        assert path.read_bytes() == raw[name], 'Source changed during rehearsal'
    report = {'scope': 'Offline feasibility rehearsal, not a full operational import or completed orientation feature',
              'source_sha256': {name: digest(value) for name, value in raw.items()},
              'reservation_sql_sha256': digest(reservation_sql.encode()),
              'products': len(groups), 'stock_skus': len(candidate['products']), 'original_public_options_unchanged': len(snapshot['products']),
              'bath_prices_pence': prices, 'bath_opening_stock_approved': False, 'bath_saleable': False,
              'frame_sizes': 3, 'frame_customer_combinations': 6, 'shared_stock': evidence,
              'sql_restore_equal': True, 'foreign_keys_ok': True, 'source_files_unchanged': True,
              'live_payments': 0, 'emails_sent': 0, 'customer_records_imported': 0,
              'production_import_authorized': False,
              'remaining': ['Opening stock and packed weights', 'Owner copy/media review', 'Actual basket/payment/order/email orientation integration', 'Owner review of full production mapping']}
    (output / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--local-review', type=Path, required=True)
    parser.add_argument('--decisions', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(rehearse(args.snapshot, args.local_review, args.decisions, args.output), indent=2))
