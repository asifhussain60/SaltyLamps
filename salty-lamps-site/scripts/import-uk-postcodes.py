#!/usr/bin/env python3
"""Build a compact D1 import from the ONS live postcode layer (August 2026).

The generated SQL is private deployment input, not a source file to commit.
Source: https://www.data.gov.uk/dataset/f10c1fb7-ae3d-4811-9f37-82d50a5fae83/online-ons-postcode-directory-live3
Northern Ireland's BT postcodes require a separate commercial licence, so this
import deliberately excludes them. The checkout still accepts manual BT entry.
"""

import concurrent.futures
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

LAYER = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Online_ONS_Postcode_Directory_Live/FeatureServer/0/query'
PAGE_SIZE = 2000
POSTCODE = re.compile(r'^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$|^GIR 0AA$')
OUT = pathlib.Path('d1/postcodes/ons-live-aug-2026.sql')


def get(params):
    url = LAYER + '?' + urllib.parse.urlencode({'f': 'json', **params})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                data = json.load(response)
            if 'error' in data:
                raise RuntimeError(data['error'])
            return data
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def page(offset):
    data = get({'where': "PCDS NOT LIKE 'BT%'", 'outFields': 'PCDS', 'orderByFields': 'OBJECTID ASC',
                'resultOffset': offset, 'resultRecordCount': PAGE_SIZE, 'returnGeometry': 'false'})
    values = [feature['attributes']['PCDS'] for feature in data['features']]
    if any(not POSTCODE.fullmatch(value or '') for value in values):
        raise ValueError(f'Invalid postcode in page {offset}')
    return offset, values


def main():
    count = get({'where': "PCDS NOT LIKE 'BT%'", 'returnCountOnly': 'true'})['count']
    offsets = range(0, count, PAGE_SIZE)
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for offset, values in pool.map(page, offsets):
            results[offset] = values
    postcodes = [value for offset in offsets for value in results[offset]]
    if len(postcodes) != count or len(set(postcodes)) != count:
        raise ValueError(f'Expected {count} unique live postcodes, got {len(postcodes)} / {len(set(postcodes))}')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w') as output:
        for index in range(0, count, 400):
            values = postcodes[index:index + 400]
            output.write('INSERT OR REPLACE INTO uk_postcodes (postcode_key, postcode) VALUES ')
            output.write(','.join(f"('{value.replace(' ', '')}','{value}')" for value in values))
            output.write(';\n')
    print(f'{count} unique live postcodes -> {OUT} ({OUT.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
