// The shop's day boundaries. Run with `npm run test:unit`.
//
// These use node:test, which is built into Node — deliberately no dependency, so
// the site's own package never grows a test framework it would have to install on
// every Cloudflare Pages build.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bucketByLondonPeriod, londonDate, londonDayStartUtc, londonMonth, londonYear,
  shiftLondonDate, shopWindows, toSqlTimestamp,
} from '../functions/lib/shop-time.mjs'

test('a summer day starts at 23:00 UTC the night before', () => {
  assert.equal(londonDayStartUtc('2026-08-28'), '2026-08-27 23:00:00')
})

test('a winter day starts at midnight UTC', () => {
  assert.equal(londonDayStartUtc('2026-01-15'), '2026-01-15 00:00:00')
})

test('the two days the clocks change are handled, not approximated', () => {
  // Spring forward: 29 March 2026. The day begins while still on GMT.
  assert.equal(londonDayStartUtc('2026-03-29'), '2026-03-29 00:00:00')
  // Autumn back: 25 October 2026. The day begins while still on BST.
  assert.equal(londonDayStartUtc('2026-10-25'), '2026-10-24 23:00:00')
})

test('THE BUG: an order at 00:30 BST counts as today, not yesterday', () => {
  // Stored as 23:30 UTC on the 27th. The dashboard used to compare this against
  // date('now') = '2026-08-28' and conclude it belonged to the previous day.
  const stored = '2026-08-27 23:30:00'
  assert.ok(stored >= londonDayStartUtc('2026-08-28'), 'should fall inside 28 August')
  assert.ok(stored < londonDayStartUtc('2026-08-29'), 'should not fall inside 29 August')
  assert.equal(londonDate(new Date('2026-08-27T23:30:00Z')), '2026-08-28')
})

test('the stored timestamp format is matched exactly, so string comparison is valid', () => {
  // SQLite writes datetime('now') as 'YYYY-MM-DD HH:MM:SS'. A bound value in any
  // other shape would compare wrongly without ever erroring.
  assert.match(londonDayStartUtc('2026-06-01'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(toSqlTimestamp(new Date('2026-06-01T12:34:56.789Z')), '2026-06-01 12:34:56')
})

test('dates shift by the calendar, not by 86,400,000 milliseconds', () => {
  assert.equal(shiftLondonDate('2026-03-01', -1), '2026-02-28')
  assert.equal(shiftLondonDate('2026-12-31', 1), '2027-01-01')
  // Across the spring transition, where a naive day of milliseconds lands short.
  assert.equal(shiftLondonDate('2026-03-30', -1), '2026-03-29')
})

test('the dashboard windows nest inside one another', () => {
  const w = shopWindows(new Date('2026-08-28T10:00:00Z'))
  assert.equal(w.today, '2026-08-28')
  assert.ok(w.weekStart < w.todayStart)
  assert.ok(w.monthStart <= w.weekStart)
  assert.ok(w.previousWeekStart < w.weekStart)
  assert.ok(w.previousMonthStart < w.monthStart)
  assert.equal(w.seriesFromDate, '2026-08-15') // fourteen days inclusive of today
})

test('the previous month is the previous month, including across a year boundary', () => {
  const jan = shopWindows(new Date('2026-01-10T10:00:00Z'))
  assert.equal(jan.monthStart, '2026-01-01 00:00:00')
  assert.equal(jan.previousMonthStart, '2025-12-01 00:00:00')
})

test('hourly rows bucket into the London month, not the UTC one', () => {
  // 23:30 UTC on 31 March is half past midnight on 1 April in London. SQLite
  // cannot know that, which is the entire reason this re-bucketing exists.
  const rows = [
    { hour: '2026-03-31T23', orders: 1, revenue_pence: 500 },
    { hour: '2026-04-01T10', orders: 2, revenue_pence: 100 },
  ]
  assert.deepEqual(bucketByLondonPeriod(rows, londonMonth), [
    { key: '2026-04', orders: 3, revenue_pence: 600 },
  ])
})

test('bucketing is stable, sorted, and ignores unparseable rows', () => {
  const rows = [
    { hour: '2026-04-01T10', orders: 1, revenue_pence: 100 },
    { hour: '2026-01-01T10', orders: 1, revenue_pence: 100 },
    { hour: 'not-a-date', orders: 99, revenue_pence: 99 },
  ]
  const out = bucketByLondonPeriod(rows, londonYear)
  assert.deepEqual(out, [{ key: '2026', orders: 2, revenue_pence: 200 }])
})
