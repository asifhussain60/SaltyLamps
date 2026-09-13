import { expect, test } from '@playwright/test'

const isLocal = /127\.0\.0\.1|localhost/.test(process.env.E2E_BASE_URL || 'http://127.0.0.1:8788')

test('the manufacturing film starts and plays without a media error', async ({ page }) => {
  await page.goto('/process')
  await page.getByRole('button', { name: 'Play the Salty Lamps manufacturing process film' }).click()
  const video = page.locator('.process-film video')
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(2)
  expect(await video.evaluate(v => v.error?.code)).toBeUndefined()
  expect(await video.evaluate(v => v.duration)).toBeCloseTo(54.625, 1)
})

test('the manufacturing film plays through both repaired scenes', async ({ page }) => {
  test.setTimeout(90_000)
  test.skip(isLocal, 'the first playback test covers the local asset server')
  await page.goto('/process')
  await page.getByRole('button', { name: 'Play the Salty Lamps manufacturing process film' }).click()
  const video = page.locator('.process-film video')
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2)
  const metadata = await video.evaluate(v => ({
    duration: v.duration, width: v.videoWidth, height: v.videoHeight, error: v.error?.code,
  }))
  expect(metadata.error).toBeUndefined()
  expect(metadata.duration).toBeGreaterThan(54.5)
  expect(metadata.duration).toBeLessThan(54.8)
  expect(metadata.width / metadata.height).toBeCloseTo(16 / 9, 2)
  // Cloudflare Pages serves the complete video for byte-range requests. Follow
  // the actual end-user journey and let the short film play naturally through
  // each repaired scene instead of asserting unsupported random access.
  for (const second of [18, 38, 52]) {
    await expect.poll(
      () => video.evaluate(v => v.currentTime),
      { timeout: 65_000 },
    ).toBeGreaterThan(second)
    expect(await video.evaluate(v => v.error?.code)).toBeUndefined()
  }
})
