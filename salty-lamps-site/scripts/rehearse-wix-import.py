#!/usr/bin/env python3
"""Private local-only rehearsal. No production writes, payment or email actions."""
import argparse, csv, hashlib, io, json, os, pathlib, sqlite3
ROOT=pathlib.Path(__file__).resolve().parents[1]
FIELDS=json.loads((ROOT/'functions/lib/wix-fields.json').read_text())
SCHEMA=(ROOT/'d1/staging/wix-business-records.sql').read_text()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def recovery_sql(db):
    # Older Python iterdump implementations emit sqlite_sequence before the
    # AUTOINCREMENT table that creates it. Move only complete internal-table
    # statements, never split SQL lines (original values can contain newlines).
    statements=list(db.iterdump())
    sequence=[s for s in statements if s.startswith(('DELETE FROM "sqlite_sequence";', 'INSERT INTO "sqlite_sequence" VALUES('))]
    body=[s for s in statements if s not in sequence]
    if not body or body[-1]!='COMMIT;': raise ValueError('Unexpected SQL dump transaction')
    return '\n'.join(body[:-1]+sequence+body[-1:])+'\n'
def read_sources(folder):
    datasets={}
    for kind,definition in FIELDS.items():
        raw=(folder/definition['file']).read_bytes()
        parsed=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'),newline='')))
        expected=[f['source'] for f in definition['fields']]
        if not parsed or parsed[0]!=expected: raise ValueError(f'{kind}: unknown, missing, reordered or duplicate columns')
        if any(len(row)!=len(expected) for row in parsed[1:]): raise ValueError(f'{kind}: malformed row width')
        datasets[kind]={'raw':raw,'rows':parsed[1:],'headers':expected}
    return datasets

def reconcile_relationships(data):
    records={k:[dict(zip(v['headers'],r)) for r in v['rows']] for k,v in data.items()}
    ids=[r['Order ID'] for r in records['orders']]
    if not all(ids) or len(ids)!=len(set(ids)): raise ValueError('Empty or duplicate order identity')
    if set(ids)!={r['Order ID'] for r in records['items']}: raise ValueError('Order/item identity mismatch')
    orders={r['Order ID']:r for r in records['orders']}
    common=['Order number','Contact email','Currency','Total','Payment status','Refunded amount','Net amount','Amount paid']
    for r in records['items']:
        if any(r[k]!=orders[r['Order ID']][k] for k in common): raise ValueError('Order/line summary values disagree')
    parents=set(); current=None
    for r in records['products']:
        if r['fieldType']=='PRODUCT':
            if not r['handle'] or r['handle'] in parents: raise ValueError('Empty or duplicate product identity')
            parents.add(r['handle']); current=r['handle']
        elif r['fieldType'] not in ('VARIANT','MEDIA'): raise ValueError('Unknown product row type')
        elif not current or (r['handle'] and r['handle']!=current): raise ValueError('Unresolved product child relationship')
    return records

def import_snapshot(db,data):
    hashes={k:sha(v['raw']) for k,v in data.items()}; batch=sha(json.dumps(hashes,sort_keys=True).encode())
    db.executescript(SCHEMA)
    with db:
        exists=db.execute('SELECT 1 FROM wix_import_batches WHERE id=?',(batch,)).fetchone()
        if not exists:
            db.execute('INSERT INTO wix_import_batches(id,source_hashes,status) VALUES(?,?,?)',(batch,json.dumps(hashes,sort_keys=True),'reconciled'))
            for kind,v in data.items():
                definition=FIELDS[kind]; cols=','.join('"'+f['column']+'"' for f in definition['fields'])
                marks=','.join('?' for _ in range(len(v['headers'])+2))
                db.executemany(f'INSERT INTO {definition["table"]}(batch_id,source_row,{cols}) VALUES({marks})',[(batch,i,*row) for i,row in enumerate(v['rows'],1)])
                db.execute('INSERT INTO wix_source_files VALUES(?,?,?)',(batch,kind,v['raw']))
        verify(db,batch,data)
    return batch, bool(exists)

def verify(db,batch,data):
    counts={}
    for kind,v in data.items():
        definition=FIELDS[kind]; cols=','.join('"'+f['column']+'"' for f in definition['fields'])
        rows=db.execute(f'SELECT {cols} FROM {definition["table"]} WHERE batch_id=? ORDER BY source_row',(batch,)).fetchall()
        if [list(r) for r in rows]!=v['rows']: raise ValueError(f'{kind}: field round trip failed')
        if db.execute('SELECT original_bytes FROM wix_source_files WHERE batch_id=? AND dataset=?',(batch,kind)).fetchone()[0]!=v['raw']: raise ValueError(f'{kind}: byte recovery failed')
        counts[kind]={'rows':len(rows),'columns':len(v['headers']),'compared_cells':sum(len(r) for r in rows),'populated_cells':sum(bool(c) for r in rows for c in r)}
    if db.execute('PRAGMA integrity_check').fetchone()!=('ok',) or db.execute('PRAGMA foreign_key_check').fetchall(): raise ValueError('Restored database integrity failure')
    return counts

def rehearse(source,destination):
    os.umask(0o077)
    data=read_sources(source); records=reconcile_relationships(data)
    destination.mkdir(parents=True,exist_ok=False)
    db=sqlite3.connect(destination/'rehearsal.sqlite'); db.execute('PRAGMA foreign_keys=ON')
    try:
        batch,_=import_snapshot(db,data); counts=verify(db,batch,data)
        before=db.total_changes; _,rerun=import_snapshot(db,data)
        if not rerun or db.total_changes!=before: raise ValueError('Import rerun changed records')
        dump=recovery_sql(db); (destination/'restore.sql').write_text(dump)
        restored=sqlite3.connect(destination/'restored.sqlite')
        try:
            restored.executescript(dump); verify(restored,batch,data)
            for kind,v in data.items():
                definition=FIELDS[kind]; cols=','.join('"'+f['column']+'"' for f in definition['fields'])
                exported=restored.execute(f'SELECT {cols} FROM {definition["table"]} WHERE batch_id=? ORDER BY source_row',(batch,)).fetchall()
                with (destination/definition['file']).open('w',encoding='utf-8-sig',newline='') as f:
                    writer=csv.writer(f); writer.writerow(v['headers']); writer.writerows(exported)
        finally: restored.close()
        reexport=read_sources(destination)
        for k in data:
            if data[k]['rows']!=reexport[k]['rows']: raise ValueError('Re-exported CSV values differ')
        with (destination/'field-mapping.csv').open('w',newline='') as f:
            writer=csv.writer(f);writer.writerow(['dataset','source_field','destination','populated_values','round_trip','operational_behavior'])
            for k,d in FIELDS.items():
                for i,field in enumerate(d['fields']): writer.writerow([k,field['source'],d['table']+'.'+field['column'],sum(bool(r[i]) for r in data[k]['rows']),'passed','historical view/search/export; live behavior acceptance remains open'])
        report={'scope':'Local historical business-record storage, full field round trip and restore only; not a production import or operational feature parity sign-off','batch':batch,'counts':counts,'field_count':sum(v['columns'] for v in counts.values()),'checks':['strict_headers','row_widths','order_item_relationships','order_line_summary_agreement','product_child_relationships','every_cell_round_trip','original_bytes_recovery','rerun_no_op','sql_dump_restore','integrity','foreign_keys','csv_reexport'],'launch_ready':False,'remaining':['Live catalogue identity merge and approved replacement content reconciliation','Operational behavior for discounts/modifiers/preorders/tax/delivery/consent and unsupported fields','Full Wix business settings, original media-manager inventory and independent backup','Protected deployed admin acceptance and fresh final delta']}
        (destination/'reconciliation.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k not in ('batch','remaining')}))
    finally: db.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('destination',type=pathlib.Path);a=p.parse_args();rehearse(a.source,a.destination)
