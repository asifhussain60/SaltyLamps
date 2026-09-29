import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config.js'

// Engine/device emulation supplements the live viewport walkthrough; it is not
// a physical-device or Cloudflare owner sign-in acceptance test.
export default defineConfig({
  ...base,
  testMatch: ['**/owner-repairs.spec.js', '**/order-review.spec.js', '**/checkout-recovery.spec.js'],
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'ipad-webkit', use: { ...devices['iPad (gen 7)'] } },
  ],
})
