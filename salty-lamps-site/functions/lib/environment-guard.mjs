// Binding checks at runtime: a development release refuses the live database,
// and a future production release refuses a database marked as development.
// Existing production databases need no write: absence of the marker means production.
export async function environmentMismatch(env) {
  const expected = env.DEPLOYMENT_ENV
  if (!['development', 'production'].includes(expected) || !env.DB) return 'Environment not configured'
  if (expected === 'production' && (env.DEVELOPMENT_SHARED_HOST || env.STRIPE_TEST_ONLY || env.MAIL_DRY_RUN)) {
    return 'Production cannot use development switches'
  }
  if (expected === 'development' && (env.STRIPE_TEST_ONLY !== '1' || env.MAIL_DRY_RUN !== 'true')) {
    return 'Development safeguards are missing'
  }
  const secret = String(env.STRIPE_SECRET_KEY || '')
  const publishable = String(env.STRIPE_PUBLISHABLE_KEY || '')
  if (expected === 'development' && ((secret && !/^(sk|rk)_test_/.test(secret))
      || (publishable && !publishable.startsWith('pk_test_')) || env.RESEND_API_KEY)) {
    return 'Live provider credentials cannot be used in development'
  }
  if (expected === 'production' && (/_test_/.test(secret) || publishable.startsWith('pk_test_'))) {
    return 'Sandbox credentials cannot be used in production'
  }
  try {
    const marker = await env.DB.prepare("SELECT value FROM settings WHERE key='deployment_environment'").first()
    const actual = marker?.value || 'production'
    if (actual !== expected) return 'Database belongs to another environment'
    if (!env.IMAGES) return 'Image environment is not configured'
    const imageMarker = await env.IMAGES.get('_environment/development.json')
    if (expected === 'production' && imageMarker) return 'Image storage belongs to development'
    if (expected === 'development') {
      if (!imageMarker) return 'Development image storage could not be verified'
      const imageIdentity = JSON.parse(await imageMarker.text())
      if (imageIdentity.environment !== 'development'
          || imageIdentity.bucket !== 'salty-lamps-development-images') return 'Image storage belongs to another environment'
    }
    return null
  } catch {
    return 'Environment database could not be verified'
  }
}
