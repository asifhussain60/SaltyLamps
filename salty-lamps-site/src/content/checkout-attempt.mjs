import {SPECIAL_INSTRUCTIONS_MAX} from '../../functions/lib/validation.mjs'
export const CHECKOUT_ATTEMPT_KEY = 'salty-lamps-checkout-attempt'
export function checkoutPayload(items,address) {
  const cleaned=Object.fromEntries(['email','name','line1','line2','city','postcode'].map(key=>[key,String(address[key]||'').trim()]))
  cleaned.email=cleaned.email.toLowerCase()
  cleaned.postcode=cleaned.postcode.toUpperCase().replace(/\s+/g,' ')
  const instructions=String(address.instructions||'').trim().slice(0,SPECIAL_INSTRUCTIONS_MAX)
  if(instructions)cleaned.instructions=instructions
  return {items:[...items].sort((a,b)=>a.skuId-b.skuId || (a.orientation || '').localeCompare(b.orientation || '')),postcode:cleaned.postcode,address:cleaned}
}
export function nextCheckoutAttempt(previous,payload) {
  const fingerprint=JSON.stringify(payload)
  if(previous?.checkoutAttemptId && previous.fingerprint===fingerprint)return previous
  return {checkoutAttemptId:crypto.randomUUID(),...(previous?.checkoutAttemptId?{previousCheckoutAttemptId:previous.checkoutAttemptId}:{}),fingerprint}
}
