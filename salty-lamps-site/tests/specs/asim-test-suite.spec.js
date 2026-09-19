import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/asim-test-suite')
})

test('Asim can record a problem, keep it after refresh and review a useful summary', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Asim Test Suite', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Full walkthrough', exact: true }).click()
  await page.getByRole('button', { name: /Your basket/ }).click()
  await page.getByRole('button', { name: 'Problem', exact: true }).click()
  await page.getByLabel('What went wrong? (optional)').fill('The quantity did not update.')
  await expect(page.getByRole('status').filter({ hasText: 'Saved in this browser' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('What went wrong? (optional)')).toHaveValue('The quantity did not update.')
  await expect(page.getByText('1 of 35 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Review summary', exact: true }).click()
  await expect(page.getByLabel('Review summary text')).toHaveValue(/The quantity did not update/)
  await expect(page.getByLabel('Review summary text')).toHaveValue(/Not checked/)
})

test('Copy summary copies the complete current results and notes to the real browser clipboard', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Problem', exact: true }).click()
  await page.getByLabel('What went wrong? (optional)').fill('Computer check: quantity stayed at 2.\nPlease check 4 and 12 too.')
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await page.getByRole('button', { name: 'Works', exact: true }).click()
  await page.locator('.asim-case[open]').getByLabel('Add a note (optional)').fill('Phone check: 12 lamps worked ✓')
  await page.getByRole('button', { name: 'Review summary', exact: true }).click()
  const expected = await page.getByLabel('Review summary text').inputValue()
  // Headless Chromium denies clipboard access by default; exercise the permission-allowed browser path.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy summary', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Review summary copied.' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(expected)
  expect(copied).toContain('Computer check: quantity stayed at 2.\nPlease check 4 and 12 too.')
  expect(copied).toContain('Phone check: 12 lamps worked ✓')
  expect(copied).toContain('COMPUTER')
  expect(copied).toContain('PHONE')
  // Pasting through the browser keyboard confirms the clipboard can be used, not merely read by the page.
  await page.locator('.asim-case[open]').getByLabel('Add a note (optional)').fill('')
  await page.locator('.asim-case[open]').getByLabel('Add a note (optional)').press('ControlOrMeta+V')
  await expect(page.locator('.asim-case[open]').getByLabel('Add a note (optional)')).toHaveValue(expected.slice(0, 3000))
})

test('blocked copying selects the complete summary and gives manual copying instructions', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async () => { throw new DOMException('Clipboard blocked', 'NotAllowedError') },
  } }))
  await page.reload()
  await page.getByRole('button', { name: 'Review summary', exact: true }).click()
  await page.getByRole('button', { name: 'Copy summary', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Select and copy the summary below' })).toBeVisible()
  await expect(page.getByLabel('Review summary text')).toBeFocused()
  expect(await page.getByLabel('Review summary text').evaluate(el => el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: 'Review summary copied.' })).toHaveCount(0)
})

test('phone and computer results are independent and the quick pass does not erase full-pass results', async ({ page }) => {
  await page.getByRole('button', { name: 'Full walkthrough', exact: true }).click()
  await page.getByRole('button', { name: /Your basket/ }).click()
  await page.getByRole('button', { name: 'Works', exact: true }).click()
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await expect(page.getByText('0 of 35 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Computer', exact: true }).click()
  await expect(page.getByText('1 of 35 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Quick essentials', exact: true }).click()
  await expect(page.getByText('1 of 14 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next unchecked task', exact: true }).click()
  await expect(page.locator('.asim-case[open]')).toContainText('Keep your basket after a refresh')
})

test('shortcuts use this site and configuration-dependent checks explain the setup', async ({ page }) => {
  await page.getByRole('button', { name: /Your basket/ }).click()
  const link = page.getByRole('link', { name: 'Open shop', exact: true })
  await expect(link).toHaveAttribute('href', '/shop')
  await expect(link).toHaveAttribute('target', 'asim-test-shop')
  await page.getByRole('button', { name: 'Full walkthrough', exact: true }).click()
  await page.getByRole('button', { name: /Payment & orders/ }).click()
  await page.getByText('Complete an agreed test order', { exact: true }).click()
  await expect(page.locator('.asim-case[open]')).toContainText('Needs setup')
})

test('a saved browser record with invalid content does not break the page', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('salty-lamps-asim-tests-v1', '{bad json'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Asim Test Suite', exact: true })).toBeVisible()
  await expect(page.getByText('0 of 14 checked', { exact: true })).toBeVisible()
})

test('the checklist fits the screen and has no automated accessibility violations', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Asim Test Suite', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quick essentials', exact: true })).toHaveAccessibleDescription(/Start here. 14 important checks/)
  await expect(page.getByRole('button', { name: 'Full walkthrough', exact: true })).toHaveAccessibleDescription(/All 35 checks. Includes the quick checks/)
  await expect(page.getByRole('button', { name: 'Couldn’t test', exact: true })).toHaveAccessibleDescription('I could not try this or need help.')
  await page.getByText('New to this? Here’s how to use the checklist', { exact: true }).click()
  await expect(page.getByText('The shop buttons reuse the same tab, so you can keep using the same basket.', { exact: true })).toBeVisible()
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  if (process.env.ASIM_SCREENSHOTS) await page.screenshot({ path: `../outputs/asim-test-suite/${test.info().project.name}.png`, fullPage: true })
})

test('reset asks first and clears only the selected device', async ({ page }) => {
  await page.getByRole('button', { name: 'Works', exact: true }).click()
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await page.getByRole('button', { name: 'Problem', exact: true }).click()
  await page.getByRole('button', { name: 'Start this device again', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('1 of 14 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start this device again', exact: true }).click()
  await page.getByRole('button', { name: 'Clear this device’s results', exact: true }).click()
  await expect(page.getByText('0 of 14 checked', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Computer', exact: true }).click()
  await expect(page.getByText('1 of 14 checked', { exact: true })).toBeVisible()
})

test('saving failure is visible and a summary can still be downloaded', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable') } })
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Browser saving is unavailable' })).toBeVisible()
  await page.getByRole('button', { name: 'Works', exact: true }).click()
  await page.getByRole('button', { name: 'Review summary', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download summary', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('asim-test-results.txt')
  await expect(page.getByLabel('Review summary text')).toHaveValue(/Works — Order 12/)
})
