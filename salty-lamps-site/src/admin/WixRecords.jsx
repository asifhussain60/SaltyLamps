import React,{useEffect,useState,useRef} from 'react'
import { dirtyForms } from './navigation.mjs'
const snapshotTime=value=>new Date(value.replace(' ','T')+'Z').toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true})+' EST'
const LABELS={orders:'Wix orders',items:'Wix order items',contacts:'Wix contacts',products:'Wix products and media'}
const SUMMARY={orders:['order_number','contact_email','payment_status','fulfillment_status','total','currency'],items:['order_number','item','variant','qty','quantity_refunded'],contacts:['first_name','last_name','email_1','email_subscriber_status','sms_subscriber_status'],products:['fieldtype','handle','name','sku','price','inventory']}
export default function WixRecords(){
 const [dataset,setDataset]=useState('orders'),[batch,setBatch]=useState(''),[q,setQ]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0)
 const [result,setResult]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null),[state,setState]=useState('needs_review'),[notes,setNotes]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false)
 useEffect(()=>{if(dirty)dirtyForms.add('wix-review');else dirtyForms.delete('wix-review');return()=>dirtyForms.delete('wix-review')},[dirty])
 const detailRef=useRef(null)
 useEffect(()=>{if(selected)detailRef.current?.focus()},[selected])
 const leave=()=>!dirty||window.confirm('Discard unsaved review notes?')
 useEffect(()=>{let active=true;setError('');setResult(null)
  const params=new URLSearchParams({dataset,q:search,offset:String(offset),...(batch?{batch}:{})})
  fetch('/api/admin/wix-records?'+params,{credentials:'include'}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error?.message||'Could not load records.');return value}).then(value=>{if(active)setResult(value)}).catch(e=>{if(active)setError(e.message)})
  return()=>{active=false}
 },[dataset,batch,search,offset])
 useEffect(()=>{const handler=e=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty])
 function open(row){if(!leave())return;setSelected(row);setNotes(row.work_notes);setState(row.review_state);setDirty(false);setSaved('')}
 async function save(){setBusy(true);setSaved('');try{
  const res=await fetch('/api/admin/wix-records',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({dataset,batch:result.batch,row:selected.source_row,state,notes})});const value=await res.json();if(!res.ok)throw Error(value.error?.message||'Save failed.')
  setResult(current=>({...current,rows:current.rows.map(row=>row.source_row===selected.source_row?{...row,review_state:state,work_notes:notes}:row)}));setDirty(false);setSaved('Review notes saved. Original Wix values are unchanged.')
 }catch(e){setSaved(e.message)}finally{setBusy(false)}}
 async function download(){setBusy(true);setSaved('');try{
  const rows=[];let at=0,total=0
  do{const params=new URLSearchParams({dataset,batch:result.batch,q:search,offset:String(at)});const res=await fetch('/api/admin/wix-records?'+params);const value=await res.json();if(!res.ok)throw Error(value.error?.message||'Export failed.');total=value.total;if(!value.rows.length&&rows.length<total)throw Error('Incomplete export; try again.');rows.push(...value.rows.map(row=>Object.fromEntries(value.fields.map(f=>[f.source,row[f.column]]))));at+=value.rows.length}while(rows.length<total)
  const blob=new Blob([JSON.stringify({dataset,snapshot:result.batch,filter:search,records:rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`wix-${dataset}.json`;a.click();URL.revokeObjectURL(url)
 }catch(e){setSaved(e.message)}finally{setBusy(false)}}
 return <section className="admin-doc wix-records">
  <h2>Wix business records</h2><p>Search every original field, check consent, addresses, payments and item details, and keep separate review notes. Historical records cannot charge, refund, dispatch or email customers from this screen.</p>
  <p className="admin-alert">Preserving these records does not enable Wix discounts, preorders or other shop features. Those still need operational acceptance before launch.</p>
  <div className="wix-records__controls">
   <label>Record type<select value={dataset} onChange={e=>{if(!leave())return;setDataset(e.target.value);setQ('');setSearch('');setOffset(0);setSelected(null);setDirty(false)}}>{Object.entries(LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   {!!result?.batches?.length&&<label>Import snapshot<select value={batch||result.batch} onChange={e=>{if(!leave())return;setBatch(e.target.value);setOffset(0);setSelected(null);setDirty(false)}}>{result.batches.map((b,i)=><option key={b.id} value={b.id}>Snapshot {result.batches.length-i} · {snapshotTime(b.created_at)}</option>)}</select></label>}
   <form onSubmit={e=>{e.preventDefault();if(!leave())return;setSearch(q);setOffset(0);setSelected(null);setDirty(false)}}><label>Search all original fields<input value={q} onChange={e=>setQ(e.target.value)} maxLength={200}/></label><button className="admin-btn" type="submit">Search records</button></form>
  </div>
  {error&&<p role="alert">{error}</p>}{!result&&!error&&<p role="status">Loading records…</p>}
  {result&&<><p>{result.total} matching records. {result.fields.length} original fields per record.</p><button className="admin-btn" disabled={busy||!result.total} onClick={download}>Download matching original values</button>
   <div className="admin-doc__table-wrap"><table className="admin-doc__table"><thead><tr><th>Record</th>{SUMMARY[dataset].map(c=><th key={c}>{result.fields.find(f=>f.column===c)?.source||c}</th>)}<th>Review</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.source_row}><td><button className="admin-btn" onClick={()=>open(row)}>Open record {row.source_row}</button></td>{SUMMARY[dataset].map(c=><td key={c}>{row[c]||'—'}</td>)}<td>{row.review_state.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>
   {!result.total&&<p>{search?'No records match this search. Try another term or clear the search.':'No records in this snapshot. Historical records appear after a reviewed import is loaded into this environment.'}</p>}
   <div className="wix-records__controls"><button className="admin-btn" disabled={!offset} onClick={()=>{if(leave()){setOffset(Math.max(0,offset-50));setSelected(null);setDirty(false)}}}>Previous records</button><button className="admin-btn" disabled={offset+result.rows.length>=result.total} onClick={()=>{if(leave()){setOffset(offset+50);setSelected(null);setDirty(false)}}}>Next records</button></div>
   {selected&&<section ref={detailRef} tabIndex={-1} aria-label="Original Wix record"><h3>Original record {selected.source_row}</h3><div className="wix-records__controls"><label>Review status<select value={state} onChange={e=>{setState(e.target.value);setDirty(true)}}><option value="needs_review">Needs review</option><option value="reviewed">Reviewed</option><option value="follow_up">Follow up</option></select></label><label>Internal review notes<textarea value={notes} maxLength={10000} onChange={e=>{setNotes(e.target.value);setDirty(true)}}/></label><button className="admin-btn admin-btn--primary" disabled={busy||!dirty} onClick={save}>Save review notes</button></div><p role="status">{saved}</p><div className="admin-doc__table-wrap"><table className="admin-doc__table"><thead><tr><th>Wix field</th><th>Original value</th></tr></thead><tbody>{result.fields.map(f=><tr key={f.column}><th scope="row">{f.source}</th><td className="wix-records__value">{selected[f.column]===''?<em>Blank in Wix export</em>:selected[f.column]}</td></tr>)}</tbody></table></div></section>}
  </>}
 </section>
}
