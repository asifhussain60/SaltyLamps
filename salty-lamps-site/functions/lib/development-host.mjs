// Only the isolated sandbox can share shop and administration on the test host.
export function isSharedDevelopmentHost(hostname, env) {
  return hostname === 'test.saltylamps.co.uk'
    && env.DEVELOPMENT_SHARED_HOST === hostname
    && env.SITE_URL === `https://${hostname}`
    && env.ADMIN_HOSTS === hostname
    && env.STRIPE_TEST_ONLY === '1'
    && env.MAIL_DRY_RUN === 'true'
}
