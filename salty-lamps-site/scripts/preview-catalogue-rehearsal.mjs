// Loopback-only, read-only preview. No credentials, payment calls or cloud access.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { onRequestGet as products } from '../functions/api/products.js'
import { onRequestPost as delivery } from '../functions/api/checkout/delivery.js'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const folder=path.resolve(process.argv[2] || '')
if(!fs.existsSync(path.join(folder,'report.json')) || !JSON.parse(fs.readFileSync(path.join(folder,'candidate-public.json'))).rehearsalOnly)throw Error('Use an explicit completed rehearsal folder')
const snapshot=JSON.parse(fs.readFileSync(path.join(folder,'candidate-public.json')))
const sql=new DatabaseSync(path.join(folder,'catalogue.sqlite'),{readOnly:true})
const prepared=(query,args=[])=>({bind:(...values)=>prepared(query,values),all:async()=>({results:sql.prepare(query).all(...args)}),first:async()=>sql.prepare(query).get(...args)})
const env={DB:{prepare:query=>prepared(query),batch:async statements=>Promise.all(statements.map(s=>s.all()))}}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})
const dist=path.join(root,'dist')
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'}
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4198')
    let response
    if(req.method==='GET'&&url.pathname==='/api/products')response=await products({env})
    else if(req.method==='GET'&&url.pathname==='/api/categories')response=json({categories:snapshot.categories,aliases:snapshot.categoryAliases})
    else if(req.method==='GET'&&url.pathname==='/api/content')response=json(snapshot.content)
    else if(req.method==='GET'&&url.pathname==='/api/reviews')response=json({reviews:[]})
    else if(req.method==='POST'&&url.pathname==='/api/checkout/delivery'){
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>50000)throw Error('Request too large');chunks.push(chunk)}
      response=await delivery({env,request:new Request(url,{method:'POST',body:Buffer.concat(chunks)})})
    }else if(url.pathname.startsWith('/api/'))response=json({error:'This read-only rehearsal cannot take payments, send messages or change records.'},503)
    else if(req.method!=='GET'&&req.method!=='HEAD')response=new Response(null,{status:405})
    else{
      let file=path.resolve(dist,'.'+decodeURIComponent(url.pathname))
      if(!file.startsWith(dist+path.sep)&&file!==dist)throw Error('Invalid path')
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(dist,'index.html')
      response=new Response(req.method==='HEAD'?null:fs.readFileSync(file),{headers:{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}})
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
  }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}))}
}).listen(4198,'127.0.0.1',()=>console.log('Read-only local rehearsal: http://127.0.0.1:4198'))
