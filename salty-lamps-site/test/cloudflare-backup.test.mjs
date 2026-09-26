import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

test('Cloudflare backup restore and stubbed S3 safety checks', () => {
  const run = spawnSync('python3', ['test/test_cloudflare_backup.py', '-v'], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
  assert.match(run.stderr, /Ran \d+ tests/)
})
