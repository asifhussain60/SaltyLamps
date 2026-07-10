// Shared helpers for the admin API endpoints — consistent JSON responses, error
// shapes, and audit logging. Keeps each endpoint small and uniform.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

// Structured error matching the app-wide shape { error: { code, message, fields? } }.
export function apiError(message, status = 400, { code = 'bad_request', fields } = {}) {
  const error = { code, message }
  if (fields) error.fields = fields
  return json({ error }, status)
}

export function validationError(fields, message = 'Please fix the highlighted fields.') {
  return apiError(message, 400, { code: 'validation', fields })
}

// Returns a PREPARED, BOUND statement for an audit row so callers can include it in
// the same db.batch([...]) as the write it records — one atomic unit.
export function auditStmt(db, actorEmail, action, entity, entityId, detail) {
  return db
    .prepare(
      `INSERT INTO admin_audit (actor_email, action, entity, entity_id, detail)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      actorEmail || 'unknown',
      action,
      entity,
      entityId == null ? null : String(entityId),
      detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
    )
}

// Parse a JSON body defensively; returns [body, null] or [null, Response].
export async function readJson(request) {
  try {
    return [await request.json(), null]
  } catch {
    return [null, apiError('Invalid JSON body.', 400)]
  }
}

// Rows -> CSV string. columns is [{ key, label }]; values are stringified safely.
export function toCsv(rows, columns) {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map(c => esc(c.label)).join(',')
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n')
  return `${header}\n${body}\n`
}

export function csvResponse(csv, filename) {
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}
