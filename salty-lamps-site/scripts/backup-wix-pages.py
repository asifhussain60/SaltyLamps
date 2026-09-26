#!/usr/bin/env python3
"""Read-only full HTML capture of the reviewed public Wix sitemap inventory."""
import argparse,concurrent.futures,hashlib,json,os,pathlib,urllib.parse,urllib.request
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('inventory',type=pathlib.Path);p.add_argument('destination',type=pathlib.Path);a=p.parse_args();os.umask(0o077)
 urls=[r['url'] for r in json.loads(a.inventory.read_text())]
 if any(urllib.parse.urlsplit(u).scheme!='https' or urllib.parse.urlsplit(u).hostname not in ['saltylamps.co.uk','www.saltylamps.co.uk'] for u in urls):raise ValueError('Unexpected inventory host')
 a.destination.mkdir(parents=True,exist_ok=False)
 def fetch(url):
  name=hashlib.sha256(url.encode()).hexdigest()+'.html'
  try:
   with urllib.request.urlopen(url,timeout=40) as r:
    data=r.read(30*1024*1024+1)
    if not data or len(data)>30*1024*1024:raise ValueError('Invalid page size')
    final=r.geturl();ctype=r.headers.get('Content-Type','')
    if not ctype.startswith('text/html'):raise ValueError('Unexpected page type')
   (a.destination/name).write_bytes(data)
   return {'url':url,'final_url':final,'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'status':'saved'}
  except Exception as error:return {'url':url,'status':'failed','error_type':type(error).__name__}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(fetch,urls))
 report={'scope':'Full HTML for sitemap-inventoried pages; linked scripts/media and authenticated business settings require separate backups','count':len(rows),'saved':sum(r['status']=='saved' for r in rows),'pages':rows}
 (a.destination/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='pages'}))
 if report['count']!=report['saved']:raise SystemExit(1)
