// Shared instructions and validation for the protected owner acceptance review.
// This is a review record only; it never performs a purchase or edits shop data.
export const REVIEW_VERSION = 1
export const REVIEW_KEY = 'launch_review_asim_v1'
export const REPORT_PREFIX = 'launch_review_report_v1_'
export const RESULT_LABELS = { pending: 'Not tested', pass: 'Passed', issue: 'Problem found', blocked: 'Need help' }
const check = (id, title, steps, expected, path, scope = 'device', coordinated = false) => ({ id, title, steps, expected, path, scope, coordinated })
export const LAUNCH_GROUPS = [
  { id: 'shop', name: 'Explore your new shop', caption: 'The first impression, the right products and clear information.', icon: 'home', items: [
    check('home', 'Make a great first impression', ['Open the home page on your computer, then on your phone.', 'Try the menu and the links to product ranges. Return to the home page.'], 'The page looks balanced, pictures load and every link takes you where its label says. On your phone, text and buttons fit without scrolling sideways.', '/'),
    check('find', 'Find the right product', ['Open the shop and search for “lamp”.', 'Choose a category, change the sort order, then clear your choices.', 'Search for “zz-no-product”, then clear the search.'], 'Search and filters show the right products. An empty search explains what happened and lets you get back to the catalogue.', '/shop'),
    check('options', 'Check product choices and prices', ['Open a lamp with several sizes and a Saltwood Frame.', 'Switch between available sizes, packs and frame orientations.', 'Check the photos, description, price and availability for each choice.'], 'Every choice describes the item you expect to sell, with the correct price and pictures. An unavailable choice cannot be ordered.', '/shop'),
    check('info', 'Find the information customers need', ['Open the gallery, customer reviews and manufacturing page.', 'Find contact details, privacy, terms and returns information.', 'Check the text is accurate and links work.'], 'Customers can find the business and its policies. Pictures and the film work; reviews contain no invented ratings.', '/gallery'),
  ] },
  { id: 'checkout', name: 'Basket & delivery', caption: 'Try the shopping journey without taking a payment.', icon: 'box', items: [
    check('basket', 'Add, change and remove items', ['Add two different products or options.', 'Change one quantity using the number box, then remove an item.', 'Compare each line price and the basket total with the quantities.'], 'Only the chosen line changes. Quantities and totals are correct, and removing the last item gives a helpful empty-basket message.', '/shop'),
    check('quantity', 'Handle quantities safely', ['Add one available item. Try 0, a decimal quantity and a number above available stock.', 'Return to a valid whole number before continuing.'], 'Invalid quantities are explained or corrected. The basket never lets a customer order more stock than is available.', '/shop'),
    check('delivery', 'Check the delivery quote', ['Enter a real UK postcode you control.', 'Review the couriers, charges and final total. Change the quantity and check again.', 'If shipping information is missing, record the product name here rather than changing its weights.'], 'Delivery reflects the packed weights and configured rates. The final total equals items plus the delivery charge. Missing shipping information stops payment with a useful explanation.', '/checkout'),
    check('address', 'Enter and check delivery details', ['Continue to the address step using your own UK delivery address.', 'Try leaving a required field blank, then correct it.', 'Check postcode suggestions, address lines, email and phone fields. Stop before payment unless the coordinated test has been agreed.'], 'Invalid or missing details are explained clearly. Your corrected details remain intact and the next step opens when they are valid.', '/checkout'),
  ] },
  { id: 'email', name: 'Emails that feel right', caption: 'The sample messages have been sent to the business inbox.', icon: 'mail', items: [
    check('email-inbox', 'Find all 11 sample emails', ['Open info@saltylamps.co.uk and look for the 11 sample messages marked SAMPLE01 or Jane Doe.', 'Check the spam folder as well as the inbox.', 'Note any missing message or one that arrived in spam.'], 'All 11 messages arrived. The sender is Salty Lamps at orders@saltylamps.co.uk, and the messages reach the inbox.', '/admin/emails', 'shared'),
    check('email-look', 'Read the messages on both devices', ['Open an order confirmation, dispatch message and refund message on your computer and phone.', 'Check the logo, text, item list, amounts and links.'], 'The messages are readable, neatly laid out and link to the correct shop. Sample details are clearly practice content, not a new real order.', '/admin/emails'),
    check('email-reply', 'Check replies reach the business', ['Reply to one sample message with “Website email reply test”.', 'Confirm the reply appears in the business inbox.'], 'A customer can reply directly and someone at the business receives it.', '/admin/emails', 'shared'),
  ] },
  { id: 'admin', name: 'Your shop behind the scenes', caption: 'Review the real information you have already entered.', icon: 'sliders', items: [
    check('admin-signin', 'Sign in to the administrator', ['Open the administrator in a separate private browser window.', 'Sign in using saltylamps@hotmail.com. Asif checks asifhussain60@gmail.com separately.', 'Confirm the welcome page, checklist, products and orders are available.'], 'Both approved people can sign in. A signed-out visitor sees a sign-in screen rather than shop records. Do not sign out of your current checklist tab.', '/admin/welcome', 'shared'),
    check('catalogue', 'Review the catalogue and hidden products', ['Open Products and compare several items with your records.', 'Check names, descriptions, prices, pictures and size choices, including hidden products.', 'Record any discrepancy here before editing anything.'], 'All approved products and choices are present. Hidden products remain available to you in the administrator without appearing for customers.', '/admin/products', 'shared'),
    check('stock-weight', 'Check opening stock and packed weights', ['Open Inventory and the packed-weight view.', 'Review the quantities you expect to sell and the packed weights used for delivery.', 'Check that frame orientations share the correct stock for their size. Record any changes needed.'], 'Opening stock and packed weights match your business records. Changing the orientation of a frame does not invent an extra stock pool.', '/admin/inventory', 'shared'),
    check('settings', 'Check business and delivery details', ['Open Settings and review contact details and email destinations.', 'Review delivery charges and dispatch details.', 'Read the returns page and note any business wording that needs approval.'], 'Contact details, order alerts, delivery charges and policies describe how the business actually operates.', '/admin/settings', 'shared'),
  ] },
  { id: 'payment', name: 'One real payment & refund', caption: 'Coordinate this with Asif first. Do not dispatch the test order.', icon: 'receipt', items: [
    check('pay', 'Make the agreed small purchase', ['Ask Asif to arrange shop access and agree the real purchase first.', 'Choose one £1 lamp bulb. Review the final amount; the earlier quote was £4.99 including delivery.', 'Use your own card and an address you control. Enter “TEST ORDER — please refund” in Special Instructions, then complete payment yourself.'], 'Payment succeeds once, the amount matches the agreed total and the order confirmation page opens. This is a real charge; Stripe may keep its processing fee after the refund.', '/shop', 'shared', true),
    check('paid-order', 'Match the payment, order and stock', ['Open the new order in the administrator and the payment in Stripe.', 'Compare the order reference, paid amount and selected product.', 'Confirm that stock decreased by one and the order is marked paid. Do not dispatch it.'], 'One payment creates one correct paid order. Stripe, the shop and stock agree.', '/admin/orders', 'shared', true),
    check('paid-email', 'Check the actual purchase messages', ['Check the buyer confirmation and the business order alert in their real inboxes.', 'Compare the amounts and order reference with the paid order.', 'Check the test instruction in the administrator and business alert.'], 'Both messages arrive. The special instruction is visible to the business but is absent from the buyer confirmation.', '/admin/orders', 'shared', true),
    check('refund', 'Complete and verify the agreed refund', ['Coordinate the full refund with Asif and complete it yourself from the order page.', 'Wait for Stripe to show that the refund succeeded; pending does not mean returned.', 'Check the order refund status and refund email. Keep the order record, then agree and restore the test stock by hand.'], 'Stripe and the shop show the same successful full refund, the email arrives and test stock is restored. The financial record is retained.', '/admin/orders', 'shared', true),
  ] },
  { id: 'finish', name: 'Ready for review', caption: 'Share your findings before we approve the public opening.', icon: 'send', items: [
    check('feedback', 'Give us a clear picture', ['Review any “Problem found” or “Need help” answers.', 'In the comments, explain what you tried, what happened and the page or product involved.', 'Use the overall note for anything that does not fit a particular step. Do not include passwords, card numbers or customer details.'], 'Each problem has enough information for Asif to investigate. A step you could not try remains clearly marked as needing help.', null, 'shared'),
    check('final-review', 'Confirm your review is ready to share', ['Check your computer and phone answers. You can submit an incomplete review if something is blocked.', 'Read your notes, then use “Submit for review” below.', 'The public opening is agreed separately after payment, refund and remaining checks pass.'], 'Your results and comments appear in Submitted reviews for both approved administrators. Submitting a review does not open the shop or approve a payment.', null, 'shared'),
  ] },
]
export const LAUNCH_CHECKS = LAUNCH_GROUPS.flatMap(g => g.items)
export const REVIEW_SLOTS = LAUNCH_CHECKS.flatMap(c => (c.scope === 'shared' ? ['shared'] : ['computer', 'phone']).map(device => `${device}:${c.id}`))
const slotSet = new Set(REVIEW_SLOTS)
export function emptyReview() { return { version: REVIEW_VERSION, revision: 0, entries: {}, overall: '', updatedAt: null, updatedBy: null } }
export function validateReviewInput(body) {
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['save', 'submit', 'review'].includes(body.action)) return { error: 'Please reload the checklist and try again.' }
  if (typeof body.overall !== 'string' || body.overall.length > 3000 || !body.entries || typeof body.entries !== 'object' || Array.isArray(body.entries)) return { error: 'The review notes are too long or have an invalid format.' }
  const entries = {}
  for (const [key, value] of Object.entries(body.entries)) {
    if (!slotSet.has(key) || !value || typeof value !== 'object' || !Object.hasOwn(RESULT_LABELS, value.result) || typeof value.comment !== 'string' || value.comment.length > 1500) return { error: 'One answer has an invalid result or comment.' }
    entries[key] = { result: value.result, comment: value.comment.trim() }
  }
  if (body.action === 'submit' && !Object.values(entries).some(e => e.result !== 'pending' || e.comment) && !body.overall.trim()) return { error: 'Record a result or comment before submitting your review.' }
  if (body.action === 'review' && (typeof body.reportId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.reportId) || typeof body.reviewNote !== 'string' || body.reviewNote.length > 3000)) return { error: 'Choose a submitted review and keep the review note under 3,000 characters.' }
  return { value: { entries, overall: body.overall.trim(), revision: body.revision, action: body.action, reportId: body.reportId, reviewNote: body.reviewNote?.trim() } }
}
export function reviewCounts(entries = {}) {
  const counts = { total: REVIEW_SLOTS.length, pass: 0, issue: 0, blocked: 0, pending: 0 }
  for (const key of REVIEW_SLOTS) counts[entries[key]?.result || 'pending']++
  return counts
}
export function reviewText(review) {
  return ['ASIM’S SALTY LAMPS REVIEW', 'Recorded by a person; these answers are not automatic test results.', ...LAUNCH_GROUPS.flatMap(g => ['', g.name, ...g.items.flatMap(c => (c.scope === 'shared' ? ['shared'] : ['computer', 'phone']).map(device => {
    const e = review.entries[`${device}:${c.id}`]
    return `${device === 'shared' ? 'Once' : device} — ${RESULT_LABELS[e?.result || 'pending']}: ${c.title}${e?.comment ? `\nComment: ${e.comment}` : ''}`
  }))]), '', `Overall note: ${review.overall || 'None'}`].join('\n')
}
