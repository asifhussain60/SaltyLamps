// Historical Wix business records. This endpoint never invokes payment or mail code.
import fields from '../../lib/wix-fields.json' with { type: 'json' }
import { json, apiError } from '../../lib/admin-helpers.mjs'
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
function definition(kind) { return owns(fields,kind) ? fields[kind] : null }
// Keep SQLite expression depth logarithmic: wide Wix exports exceed D1's
// depth limit when fields are concatenated in a left-associative chain.
export function searchableFields(columns) {
 if(columns.length===1)return `r."${columns[0]}"`
 const middle=Math.floor(columns.length/2)
 return `(${searchableFields(columns.slice(0,middle))} || char(31) || ${searchableFields(columns.slice(middle))})`
}
export async function onRequestGet({request,env}) {
 const url=new URL(request.url), kind=url.searchParams.get('dataset')||'orders', spec=definition(kind)
 if(!spec) return apiError('Unknown record type.')
 const archive=env.WIX_ARCHIVE_DB
 if(!archive) return apiError('Historical archive is not connected to this environment.',503)
 try {
  const {results:batches}=await archive.prepare('SELECT id,created_at FROM wix_import_batches ORDER BY created_at DESC,id DESC').all()
  const batch=url.searchParams.get('batch')||batches[0]?.id
  if(!batch) return json({batches:[],rows:[],total:0,fields:spec.fields,dataset:kind})
  if(!batches.some(b=>b.id===batch)) return apiError('Unknown import snapshot.',404)
  const q=(url.searchParams.get('q')||'').slice(0,200), row=url.searchParams.get('row')
  const offset=Math.max(0,Math.floor(Number(url.searchParams.get('offset'))||0))
  const limit=50
  const clauses=['r.batch_id=?'], binds=[batch]
  if(row){ if(!/^\d+$/.test(row))return apiError('Invalid row.');clauses.push('r.source_row=?');binds.push(Number(row)) }
  if(q){clauses.push(`instr(lower(${searchableFields(spec.fields.map(f=>f.column))}),lower(?))>0`);binds.push(q)}
  const where=clauses.join(' AND ')
  const {results:rows}=await archive.prepare(`SELECT r.*,COALESCE(w.review_state,'needs_review') AS review_state,COALESCE(w.notes,'') AS work_notes FROM ${spec.table} r LEFT JOIN wix_record_work w ON w.batch_id=r.batch_id AND w.source_row=r.source_row AND w.dataset=? WHERE ${where} ORDER BY r.source_row LIMIT ? OFFSET ?`).bind(kind,...binds,limit,offset).all()
  const total=await archive.prepare(`SELECT count(*) AS n FROM ${spec.table} r WHERE ${where}`).bind(...binds).first()
  return json({dataset:kind,batch,batches,rows,total:total.n,limit,offset,fields:spec.fields})
 }catch {return apiError('Historical records are not available. Complete the reviewed import rehearsal before loading this environment.',503)}
}
export async function onRequestPut({request,env,data}) {
 if(request.headers.get('origin')!==new URL(request.url).origin) return apiError('Use this administrator site to save review notes.',403)
 const archive=env.WIX_ARCHIVE_DB
 if(!archive) return apiError('Historical archive is not connected to this environment.',503)
 let body;try{body=await request.json()}catch{return apiError('Invalid request.')}
 const spec=definition(body?.dataset)
 if(!spec||typeof body.batch!=='string'||!Number.isSafeInteger(body.row)||body.row<1||!['needs_review','reviewed','follow_up'].includes(body.state)||typeof body.notes!=='string'||body.notes.length>10000) return apiError('Check record, review state and notes (maximum 10,000 characters).')
 try {
  const exists=await archive.prepare(`SELECT source_row FROM ${spec.table} WHERE batch_id=? AND source_row=?`).bind(body.batch,body.row).first()
  if(!exists)return apiError('Record not found.',404)
  await archive.batch([
   archive.prepare(`INSERT INTO wix_record_work(batch_id,dataset,source_row,review_state,notes,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(batch_id,dataset,source_row) DO UPDATE SET review_state=excluded.review_state,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=datetime('now')`).bind(body.batch,body.dataset,body.row,body.state,body.notes,data.actorEmail),
   archive.prepare('INSERT INTO wix_review_audit(actor_email,batch_id,dataset,source_row,review_state) VALUES(?,?,?,?,?)').bind(data.actorEmail||'unknown',body.batch,body.dataset,body.row,body.state),
  ])
  return json({saved:true})
 }catch{return apiError('Could not save review notes.',500)}
}
