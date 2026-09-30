// Guards for reading the test shop's database, which holds the owner's real data.
//
// The snapshot refresh (fetch-content-snapshot.mjs, source "staging") is the only
// script allowed to touch that database outside the guarded deploy. It must never be
// able to change it, so the statements it sends are checked here before anything runs:
// each one has to be a single SELECT (or WITH ... SELECT) and none may contain a
// word that writes, alters or attaches. The queries are fixed constants, never built
// from data, so a refusal means someone edited a query, not that data looked odd.

const STARTS_READ_ONLY = /^\s*(select|with)\b/i
const WRITE_WORDS = /\b(insert|update|delete|drop|alter|create|pragma|attach|detach|vacuum|reindex|truncate)\b/i

export function assertReadOnlySql(statements) {
  if (!Array.isArray(statements) || statements.length === 0) throw new Error('No statements to check.')
  for (const statement of statements) {
    const body = String(statement).trim().replace(/;\s*$/, '')
    if (!STARTS_READ_ONLY.test(body)) {
      throw new Error(`Refusing to run a statement that does not start with SELECT or WITH: ${body.slice(0, 60)}`)
    }
    if (body.includes(';')) {
      throw new Error(`Refusing a statement that contains more than one command: ${body.slice(0, 60)}`)
    }
    const word = body.match(WRITE_WORDS)?.[1]
    if (word) throw new Error(`Refusing a statement containing "${word}": ${body.slice(0, 60)}`)
  }
  return statements
}

// `wrangler d1 execute --json` prints one object per statement, each with its rows
// under `results`. Anything else (an error object, a single unwrapped result, a failed
// statement) is refused rather than guessed at, because a half-read catalogue would
// silently build a site with missing products.
export function resultSetsFromWrangler(json, expected) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (!Array.isArray(parsed)) throw new Error('wrangler did not return a list of result sets.')
  if (parsed.length !== expected) throw new Error(`expected ${expected} result sets, got ${parsed.length}.`)
  return parsed.map((set, index) => {
    if (!set || set.success === false || !Array.isArray(set.results)) {
      throw new Error(`result set ${index + 1} failed or has no rows.`)
    }
    return set.results
  })
}
