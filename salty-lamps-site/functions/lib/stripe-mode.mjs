// A published test shop must fail closed if someone later attaches live keys.
// The flag is set on the Cloudflare test project, never inferred from its URL.
export function isStripeTestKey(key) {
  return /^(sk|rk)_test_/.test(String(key || ''))
}

export function stripeModeAllowed(env) {
  if (env?.STRIPE_TEST_ONLY !== '1') return true
  return isStripeTestKey(env.STRIPE_SECRET_KEY)
    && String(env.STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_test_')
}

export function stripeEventAllowed(env, event) {
  return env?.STRIPE_TEST_ONLY !== '1' || event?.livemode === false
}
