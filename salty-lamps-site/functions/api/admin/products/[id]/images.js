// Image uploads use durable request keys so a lost response cannot duplicate a gallery.
import { json, apiError, auditStmt } from '../../../../lib/admin-helpers.mjs'
import { readUploadedImage, putImageObject, hasImageStorage } from '../../../../lib/image-upload.mjs'

export async function onRequestPost({ params, request, env, data }) {
  if (!hasImageStorage(env)) return apiError('Image storage is not configured.',503,{code:'no_storage'})
  const requestKey=request.headers.get('Idempotency-Key') || crypto.randomUUID()
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) return apiError('Invalid image request identifier.',400)
  const [upload,error]=await readUploadedImage(request)
  if(error)return error
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',upload.buffer)),b=>b.toString(16).padStart(2,'0')).join('')
  const requestId=`image_${requestKey}`
  const actor=data.actorEmail || 'unknown'
  const fingerprint=JSON.stringify({product:params.id,digest})
  const replay=async()=>{
    const row=await env.DB.prepare('SELECT * FROM admin_save_requests WHERE request_id=?').bind(requestId).first()
    if(!row)return null
    if(row.actor_email!==actor || row.fingerprint!==fingerprint)return apiError('This image request identifier was already used for another upload.',409)
    return json(JSON.parse(row.result_json))
  }
  try {
    const previous=await replay();if(previous)return previous
    if(!(await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(params.id).first()))return apiError('Product not found.',404)
    // Including the content digest prevents conflicting reuse from changing a saved object.
    const {key,path}=await putImageObject(env,params.id,upload,`${requestKey}-${digest}`)
    const statements=[
      env.DB.prepare('INSERT INTO admin_save_requests(request_id,actor_email,fingerprint,result_json) VALUES(?,?,?,?)').bind(requestId,actor,fingerprint,'{}'),
      env.DB.prepare('INSERT INTO product_images(product_id,key,path,sort_order) SELECT ?,?,?,COALESCE(MAX(sort_order),-1)+1 FROM product_images WHERE product_id=?').bind(params.id,key,path,params.id),
      env.DB.prepare('UPDATE products SET image=(SELECT path FROM product_images WHERE product_id=? ORDER BY sort_order,id LIMIT 1) WHERE id=?').bind(params.id,params.id),
      env.DB.prepare("UPDATE admin_save_requests SET result_json=(SELECT json_object('id',pi.id,'path',pi.path,'sort_order',pi.sort_order,'primary_path',p.image) FROM product_images pi JOIN products p ON p.id=pi.product_id WHERE pi.product_id=? AND pi.key=? LIMIT 1) WHERE request_id=?").bind(params.id,key,requestId),
      auditStmt(env.DB,actor,'image.add','product',params.id,{key,request_id:requestId}),
    ]
    try {await env.DB.batch(statements)} catch(e) { const raced=await replay();if(raced)return raced;throw e }
    const saved=await env.DB.prepare('SELECT result_json FROM admin_save_requests WHERE request_id=?').bind(requestId).first()
    return json(JSON.parse(saved.result_json),201)
  }catch(e){return apiError(`Could not upload image: ${e.message}`,500,{code:'server_error'})}
}
