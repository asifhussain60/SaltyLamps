import { validateEnquiry } from './validation.mjs'

export const FEEDBACK_TOPICS = ['Something went wrong', 'An idea or suggestion', 'A compliment', 'Something else']
export const FEEDBACK_TEMPLATE = {
  key: 'admin_feedback', enabled: 1, subject: 'Website feedback from {{name}}',
  preheader: 'A visitor has shared feedback with Salty Lamps.', heading: 'New website feedback',
  intro: 'The feedback is saved in Emails → Feedback. Reply to this email to answer the sender.',
  cta_label: 'Read feedback', outro: '',
}

export function validateFeedback(input) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const result = validateEnquiry({ ...body, source: 'chat' })
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const page = typeof body.page === 'string' ? body.page.trim() : ''
  if (!FEEDBACK_TOPICS.includes(topic)) result.errors.topic = 'Choose a feedback type.'
  // Store a path only: never retain checkout queries, tokens or external links.
  if (page && (page.length > 300 || !/^\/(?!\/)[^?#\s\\]*$/.test(page))) result.errors.page = 'Use a page path such as /shop, without a query or full website address.'
  return { ok: Object.keys(result.errors).length === 0, errors: result.errors,
    value: { ...result.value, source: 'feedback', topic, page } }
}
