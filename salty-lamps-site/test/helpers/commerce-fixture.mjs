import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export function commerceFixture() {
  const sql = new DatabaseSync(':memory:')
  for (const file of ['schema.sql', 'migrations/005-email.sql', 'migrations/011-product-weights.sql', 'migrations/014-commerce-safety.sql', 'migrations/016-frame-choices.sql', 'migrations/017-product-intro.sql']) {
    const path = new URL(`../../d1/${file}`, import.meta.url)
    if (fs.existsSync(path)) sql.exec(fs.readFileSync(path, 'utf8'))
  }
  sql.exec(`INSERT INTO products(id,name,slug) VALUES('p','Fixture lamp','fixture');
    INSERT INTO skus(id,sku,product_id,price_pence,track_mode,quantity,in_stock) VALUES(1,'ONE','p',1000,'quantity',1,1);
    INSERT INTO sku_weights(sku_id,packed_weight_g,postal_group) VALUES(1,1000,'Standard');`)
  const config = {unit:'kg',show_cards:false,split_parcels:true,rates:[{id:'standard',group:'Standard',service:'Tracked',country:'GB',postcodes:'',min_g:0,max_g:10000,price_pence:500}]}
  sql.prepare("UPDATE settings SET value=? WHERE key='postage_config'").run(JSON.stringify(config))
  const wrap = (query, args = []) => ({
    bind: (...a) => wrap(query, a),
    first: async () => sql.prepare(query).get(...args),
    all: async () => ({results:sql.prepare(query).all(...args)}),
    run: async () => execute(query,args),
    execute: () => execute(query,args),
  })
  function execute(query,args) {
    const statement=sql.prepare(query)
    if(statement.columns().length) return {results:statement.all(...args),meta:{changes:0}}
    const result=statement.run(...args)
    return {results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}
  }
  const db={prepare:query=>wrap(query),batch:async statements=>{
    sql.exec('BEGIN')
    try {const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results}
    catch(error){sql.exec('ROLLBACK');throw error}
  }}
  return {sql,db}
}
export const fixtureAddress={email:'buyer@example.invalid',name:'Fixture Buyer',line1:'1 Test Road',line2:'',city:'Stoke',postcode:'ST4 3NP'}
export function fixtureRequest(path,body,method='POST') {
  return new Request(`http://localhost${path}`,{method,body:JSON.stringify(body)})
}
