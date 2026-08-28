// The shop's day, as the shop experiences it.
//
// THE BUG THIS EXISTS TO FIX. Every timestamp in this database is UTC —
// `created_at TEXT NOT NULL DEFAULT (datetime('now'))`, and SQLite's `now` is
// UTC. Cloudflare Workers also run in UTC, so `date('now')` inside a query is
// the UTC day. That is invisibly wrong for a shop in Stoke-on-Trent: from late
// March to late October the UK is on British Summer Time, one hour ahead, so
// the UTC day begins at 01:00 local. An order placed at half past midnight was
// therefore counted against YESTERDAY on the dashboard, on the day the owner was
// most likely to be looking — and "this month" was wrong for the first hour of
// every month, "this year" for the first hour of every year.
//
// Nothing failed and nothing was logged. The number was simply not the number.
//
// HOW IT IS FIXED. The boundaries are computed here, in JavaScript, which knows
// the DST rules through Intl, and passed into SQL as bound parameters. SQLite is
// never asked what day it is — it only ever compares two strings, which is a
// thing it is good at. The stored format (`YYYY-MM-DD HH:MM:SS`, UTC) sorts
// lexicographically in the same order as it sorts chronologically, which is why
// a plain string comparison against a bound boundary is correct.
//
// NOT CHANGED, DELIBERATELY: how timestamps are stored. Storing UTC is right.
// Only the reading of them was wrong.

const ZONE = 'Europe/London'

// Intl gives the wall-clock reading in London for an instant. Comparing that
// against the same instant read as UTC gives the offset then in force, DST
// included, without hardcoding any transition date.
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

function londonParts(instant) {
  const out = {}
  for (const { type, value } of PARTS.formatToParts(instant)) {
    if (type !== 'literal') out[type] = value
  }
  // 'en-GB' renders midnight as '24' rather than '00' in some runtimes; both mean
  // the start of this calendar day, so normalise rather than trusting either.
  if (out.hour === '24') out.hour = '00'
  return out
}

// London's offset from UTC, in milliseconds, at a given instant.
function offsetMs(instant) {
  const p = londonParts(instant)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  // Seconds resolution is all Intl gives; the offset is a whole number of hours
  // in this zone, so nothing is lost.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

// The London calendar date of an instant, as 'YYYY-MM-DD'.
export function londonDate(instant = new Date()) {
  const p = londonParts(instant)
  return `${p.year}-${p.month}-${p.day}`
}

// The London calendar month of an instant, as 'YYYY-MM'.
export function londonMonth(instant = new Date()) {
  return londonDate(instant).slice(0, 7)
}

// The London calendar year of an instant, as 'YYYY'.
export function londonYear(instant = new Date()) {
  return londonDate(instant).slice(0, 4)
}

// The UTC instant at which a London calendar day begins, formatted the way the
// database stores timestamps so it can be compared directly.
//
// The two-pass calculation is not defensiveness for its own sake: on the two days
// a year when the clocks change, the offset at the START of the day differs from
// the offset in the middle of it, so a single guess lands an hour out on exactly
// the days it matters most.
export function londonDayStartUtc(isoDate) {
  const naive = Date.parse(`${isoDate}T00:00:00Z`)
  const firstGuess = new Date(naive - offsetMs(new Date(naive)))
  const corrected = new Date(naive - offsetMs(firstGuess))
  return toSqlTimestamp(corrected)
}

// 'YYYY-MM-DD HH:MM:SS' — the exact shape SQLite's datetime('now') writes, so a
// bound value and a stored value are comparable as plain strings.
export function toSqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

// Shift a London calendar date by whole days, staying on the calendar rather than
// adding 86,400,000 milliseconds — which is not a day on the two days a year the
// clocks change.
export function shiftLondonDate(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`) // midday, so a DST shift cannot roll the date
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Every boundary the dashboard and the reports need, computed once per request.
//
// `weekStart` is the last seven days including today, matching what the existing
// queries meant by `date('now','-6 days')` — a rolling week, not a calendar one.
// `seriesFrom` is the fourteen-day chart window, likewise inclusive of today.
export function shopWindows(now = new Date()) {
  const today = londonDate(now)
  const monthFirst = `${today.slice(0, 7)}-01`
  const prevMonthFirst = londonDate(new Date(`${monthFirst}T12:00:00Z`).setUTCDate(0))
    .slice(0, 7) + '-01'

  return {
    today,
    todayStart: londonDayStartUtc(today),
    tomorrowStart: londonDayStartUtc(shiftLondonDate(today, 1)),
    yesterdayStart: londonDayStartUtc(shiftLondonDate(today, -1)),
    weekStart: londonDayStartUtc(shiftLondonDate(today, -6)),
    previousWeekStart: londonDayStartUtc(shiftLondonDate(today, -13)),
    monthStart: londonDayStartUtc(monthFirst),
    previousMonthStart: londonDayStartUtc(prevMonthFirst),
    seriesFromDate: shiftLondonDate(today, -13),
    seriesFrom: londonDayStartUtc(shiftLondonDate(today, -13)),
    salesDefaultFromDate: shiftLondonDate(today, -29),
    salesDefaultFrom: londonDayStartUtc(shiftLondonDate(today, -29)),
  }
}

// Re-bucket rows keyed by UTC hour into London calendar periods.
//
// Grouping cannot be done in SQL: SQLite has no timezone database, so it cannot
// know that 23:30 UTC on 31 March is half past midnight on 1 April in London.
// Asking the database for hourly totals and adding them up here is exact, and the
// row count is bounded by the number of distinct hours in which the shop actually
// took an order — far smaller than the order count for any real shop.
//
// `rows` are { hour: 'YYYY-MM-DDTHH', orders, revenue_pence }; `keyOf` maps an
// instant to whatever period is wanted ('YYYY-MM', 'YYYY', 'YYYY-MM-DD').
export function bucketByLondonPeriod(rows, keyOf) {
  const totals = new Map()
  for (const row of rows) {
    const instant = new Date(`${row.hour}:00:00Z`)
    if (Number.isNaN(instant.getTime())) continue
    const key = keyOf(instant)
    const acc = totals.get(key) || { orders: 0, revenue_pence: 0 }
    acc.orders += Number(row.orders) || 0
    acc.revenue_pence += Number(row.revenue_pence) || 0
    totals.set(key, acc)
  }
  return [...totals.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}
