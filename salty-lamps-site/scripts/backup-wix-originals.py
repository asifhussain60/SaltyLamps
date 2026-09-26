#!/usr/bin/env python3
"""Archive untransformed exported Wix media, without modifying source exports."""
import argparse, concurrent.futures, csv, hashlib, json, os, pathlib, re, urllib.request

def backup(source, destination):
    os.umask(0o077)
    destination.mkdir(parents=True, exist_ok=False)
    with source.open(encoding='utf-8-sig', newline='') as handle:
        rows=list(csv.DictReader(handle))
    references={}
    for ordinal,row in enumerate(rows,1):
        media=row.get('media','')
        if not media: continue
        if not re.fullmatch(r'[A-Za-z0-9_~.%-]+',media):
            raise ValueError('Unsupported media reference; explicit mapping required')
        references.setdefault(media,[]).append({'row':ordinal,'handle':row['handle'],'type':row['fieldType']})
    def fetch(item):
        key,parents=item; url='https://static.wixstatic.com/media/'+key
        try:
            with urllib.request.urlopen(url,timeout=40) as response:
                if response.geturl()!=url: raise ValueError('Unexpected redirect')
                data=response.read(80*1024*1024+1)
                if not data or len(data)>80*1024*1024: raise ValueError('Invalid media size')
                content_type=response.headers.get('Content-Type','')
                if not content_type.startswith(('image/','video/')): raise ValueError('Unexpected media type')
            target=destination/key
            target.write_bytes(data)
            digest=hashlib.sha256(data).hexdigest()
            if hashlib.sha256(target.read_bytes()).hexdigest()!=digest: raise ValueError('Read-back failed')
            return {'key':key,'source':url,'references':parents,'bytes':len(data),'sha256':digest,'content_type':content_type,'status':'verified'}
        except Exception as error:
            return {'key':key,'references':parents,'status':'failed','error_type':type(error).__name__}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(fetch,references.items()))
    report={'scope':'All media references in product export; unreferenced Media Manager assets remain outside this scope','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_references':sum(len(v) for v in references.values()),'unique_media':len(results),'verified':sum(r['status']=='verified' for r in results),'objects':results}
    (destination/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='objects'}))
    if report['verified']!=len(results): raise SystemExit(1)
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('source',type=pathlib.Path); parser.add_argument('destination',type=pathlib.Path)
    args=parser.parse_args(); backup(args.source,args.destination)
