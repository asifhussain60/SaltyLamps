#!/usr/bin/env python3
"""Read-only, local catalogue comparison. Candidate links are never import approval."""
import argparse
import collections
import csv
import hashlib
import json
from pathlib import Path


def compare(source, snapshot):
    source_bytes = source.read_bytes()
    snapshot_bytes = snapshot.read_bytes()
    with source.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    existing = json.loads(snapshot_bytes)
    groups = []
    current = None
    for ordinal, row in enumerate(rows, 1):
        if row['fieldType'] == 'PRODUCT':
            current = {'source_row': ordinal, 'parent': row, 'variants': []}
            groups.append(current)
        elif row['fieldType'] == 'VARIANT':
            if current is None:
                raise ValueError('Variant without parent')
            current['variants'].append(row)
    replacement = collections.defaultdict(list)
    for row in existing['products']:
        replacement[row['productId']].append(row)
    findings = []
    for group in groups:
        parent = group['parent']
        candidates = [key for key, options in replacement.items()
                      if options[0]['productName'] == parent['name']]
        basis = 'exact product name'
        if len(candidates) > 1 and parent['sku']:
            candidates = [key for key in candidates
                          if parent['sku'] in [o['sku'] for o in replacement[key]]]
            basis = 'exact product name plus parent SKU'
        selected = candidates[0] if len(candidates) == 1 else None
        variants = group['variants'] or [parent]
        fields = ['sku', 'price', 'inventory', 'weight', 'visible']
        fields += [f'productOptionChoices{i}' for i in range(1, 7)]
        findings.append({
            'source_row': group['source_row'], 'source_handle': parent['handle'],
            'name': parent['name'], 'source_visible': parent['visible'], 'source_option_count': len(variants),
            'source_options': [{k: row[k] for k in fields} for row in variants],
            'candidate_ids': candidates, 'candidate_basis': basis,
            'replacement_option_count': len(replacement[selected]) if selected else None,
            'replacement_options': replacement[selected] if selected else [],
            'exact_identity_match': bool(selected and selected == parent['handle']),
            'approved': False,
        })
    used = {i['candidate_ids'][0] for i in findings if len(i['candidate_ids']) == 1}
    # Repeated proposed destinations are surfaced, never silently accepted.
    proposed = collections.Counter(i['candidate_ids'][0] for i in findings if len(i['candidate_ids']) == 1)
    return {
        'scope': 'Local Wix export versus local replacement snapshot only; no current remote data or mapping approval implied.',
        'source_sha256': hashlib.sha256(source_bytes).hexdigest(),
        'snapshot_sha256': hashlib.sha256(snapshot_bytes).hexdigest(),
        'snapshot_generated_at': existing.get('generatedAt'),
        'source_products': len(groups), 'source_options': sum(x['source_option_count'] for x in findings),
        'replacement_products': len(replacement), 'replacement_options': len(existing['products']),
        'candidate_matches': len(used),
        'absent_from_public_snapshot': [{'name': x['name'], 'source_visible': x['source_visible']} for x in findings if not x['candidate_ids']],
        'ambiguous_products': [x['name'] for x in findings if len(x['candidate_ids']) > 1],
        'duplicate_candidate_destinations': [key for key, count in proposed.items() if count > 1],
        'replacement_without_candidate': [key for key in replacement if key not in used],
        'option_count_differences': [{'name': x['name'], 'wix': x['source_option_count'], 'replacement': x['replacement_option_count']}
                                   for x in findings if x['replacement_option_count'] is not None and x['source_option_count'] != x['replacement_option_count']],
        'findings': findings, 'production_import_performed': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('report', type=Path)
    args = parser.parse_args()
    report = compare(args.source, args.snapshot)
    with args.report.open('x', encoding='utf-8') as output:
        json.dump(report, output, indent=2, ensure_ascii=False)
        output.write('\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'findings'}, indent=2))
