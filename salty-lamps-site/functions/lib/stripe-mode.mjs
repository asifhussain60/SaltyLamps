// A published test shop must fail closed if someone later attaches live keys.
// The flag is set on the Cloudflare test project, never inferred from its URL.
export function stripeModeAllowed(env) {
  if (env?.STRIPE_TEST_ONLY !== '1') return true
  return String(env.STRIPE_SECRET_KEY || '').startsWith('sk_test_')
    && String(env.STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_test_')
}

export function stripeEventAllowed(env, event) {
  return env?.STRIPE_TEST_ONLY !== '1' || event?.livemode === false
}
