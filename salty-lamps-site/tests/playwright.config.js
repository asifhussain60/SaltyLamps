// Regression suite for the whole shop — storefront, admin, SEO and the admin
// host split.
//
// ONE SUITE, THREE TARGETS. E2E_BASE_URL points it at whichever site is being
// checked, so the same tests run against a laptop, the test site, and production
// on its temporary .pages.dev address before the domain moves:
//
//   npm test                                                   # local, starts its own server
//   E2E_BASE_URL=https://salty-lamps-proposal.pages.dev npm test
//   E2E_BASE_URL=https://salty-lamps.pages.dev npm test        # production, before go-live
//
// The migration runbook's regression phase is this command plus the checks a
// machine cannot make — that a photograph is the right photograph, that the copy
// reads well, that a real card is charged and refunded.
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8788'
const isLocal = /127\.0\.0\.1|localhost/.test(baseURL)

// Normally Playwright downloads its own browser and this is empty — which is what
// happens on the owner's Mac after `npx playwright install chromium`. Some build
// environments ship a Chromium already and forbid the download; PLAYWRIGHT_CHROMIUM_PATH
// points at it. Kept as an environment variable rather than a hardcoded path so the
// config stays the same everywhere.
const browser = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
  : {}

export default defineConfig({
  testDir: './specs',
  // Against a deployed site these tests are read-mostly and independent, so they
  // parallelise. The admin specs write, and are serialised within their own file.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry everywhere, not just in CI. These drive a real browser against a real
  // server over a real network; a single timeout under parallel load is not a
  // regression and reporting it as one teaches people to ignore the suite. A test
  // that fails twice in a row is a genuine failure.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The admin on the test site answers without a sign-in only for hostnames
    // named in ADMIN_OPEN_HOSTS. Against a production site behind Cloudflare
    // Access, supply a service token and these tests reach the admin the same way
    // the catalogue tools do.
    extraHTTPHeaders: process.env.CF_ACCESS_CLIENT_ID
      ? {
          'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
          'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
        }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...browser } },
    // A real phone profile, not a narrow desktop window. Most of this shop's
    // visitors are on one, and Core Web Vitals are judged on mobile.
    { name: 'mobile', use: { ...devices['Pixel 7'], ...browser } },
  ],
  // Locally the suite brings up the real backend — Functions, D1 and R2 — because
  // `vite dev` does not run Functions at all and every admin test would fail
  // against it for the wrong reason.
  webServer: isLocal
    ? {
        command: 'npx wrangler pages dev dist --port 8788 --d1 DB=salty-lamps-db --r2 IMAGES=salty-lamps-images',
        cwd: '..',
        url: 'http://127.0.0.1:8788/api/products',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
})
