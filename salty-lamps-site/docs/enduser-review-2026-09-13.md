# End-user experience review — proposal site

## Repair and verification update

The complete repair pass was implemented on 13 September 2026. The original findings below are retained as the evidence record; their current disposition is:

| Finding | Resolution |
| --- | --- |
| Public owner portal | Fixed in application and server handling. Deployed hosts now fail closed when an owner hostname is not configured; local development remains available. |
| False payment success and cart clearing | Fixed. Payment completion is verified with the payment provider on the server before success is shown or the cart is cleared. |
| Invented ratings and verified-buyer labels | Fixed. Legacy notes are presented as unrated, unverified guestbook comments. |
| Empty Saltwood journey | Fixed. It is hidden from the home buying paths while unpriced and has an intentional project-enquiry page at its direct address. |
| Incorrect collection grouping | Fixed with public catalogue rules and purpose tags; database cleanup is prepared separately. |
| Internal merchandising copy | Fixed. Public pages now use customer-facing “Best for” copy. |
| Returns wording | Fixed with a delivery-based cancellation window and clearer return steps, pending final business review. |
| Placeholder privacy and terms | Replaced with structured, plain-English working notices, pending final business review. |
| Unsupported product and testimonial claims | Removed from public output; spelling errors and the affected catalogue descriptions were corrected. |
| Overlay accessibility | Fixed with labelled dialogs, focus movement, focus containment, Escape handling, background isolation, and focus restoration. |
| Navigation label, loading counts and missing-page status | Fixed. |
| Delivery information and checkout charging | Customer guidance and weight-based charging are implemented. Checkout now stops safely when an item or postal rate is missing; real packed weights and postal rates still require the business owner's completed figures. |
| Owner-screen labels and chart summary | Fixed for the audited controls. |
| Mobile navigation | Replaced with a compact menu and verified in an emulated phone browser. |

Verification covered 56 focused server and catalogue checks, plus the repaired desktop and mobile buyer journeys in a production build. The deployed home and guestbook now agree on 186 publishable comments. No financial transaction, refund, email, enquiry, newsletter signup, or destructive owner action was submitted. Real packed weights and postal rates, followed by a completed test payment and refund, remain the external-service acceptance work.

Reviewed 13 September 2026 against the deployed Cloudflare Pages proposal in desktop Chrome. The review used the running interface for the principal buyer and owner journeys, then checked the corresponding source and read-only API responses where that explained an observed result.

No enquiry, refund, newsletter, email test, checkout, delete, or record-edit action was submitted. One item was added to the browser-session cart; visiting the success URL cleared that local cart. Individual order records were not opened and personal details observed in the unprotected admin were not copied into this report.

## Coverage

| Journey or view | Coverage | Result |
| --- | --- | --- |
| Home | Orientation, main calls to action, buyer paths, trade form, reviews, footer | Reviewed |
| Shop | Loading, search, empty result, category navigation, sort control, availability | Reviewed |
| Product preview | Multi-option product, sold-out option, Escape close, focus behavior | Reviewed |
| Product detail | Option choice, price, availability, add-to-cart entry, reassurance content | Reviewed |
| Cart | Open, line item, quantity controls, subtotal, checkout entry, close | Reviewed without starting checkout |
| Buyer collections | Home and gifts, kitchen and food, horses and farm, trade and spa, Saltwood Frames | All five reviewed |
| Category | Salt lamps representative; common template and data behavior checked | Reviewed |
| Gallery | Buyer-theme routes and product links | Reviewed |
| Manufacturing / About | Process content, film entry, product overview | Reviewed |
| Reviews | Summary, rating display, themes, featured and archive notes | Reviewed |
| Policies | Privacy, terms, returns and exchanges | Reviewed |
| Refund request | Empty-form validation and recovery copy | Reviewed without submission |
| Checkout outcomes | Direct success and cancellation URLs | Reviewed without payment |
| Missing page | Recovery message and response status | Reviewed |
| Admin | Dashboard, products, categories, inventory, reports, emails, settings | Reviewed without mutations or order-detail access |
| Narrow/mobile layout | Responsive rules inspected; live device viewport was not available in this browser session | Partially verified |

## Release blockers

### 1. The proposal admin and its data-changing controls are public

**Evidence.** Opening the public proposal address with `/admin` displayed the owner dashboard without sign-in. Read-only requests to the order, product, category, report, and settings admin endpoints returned successful responses. The admin response explicitly identifies the host as an open host. The interface exposes order information and controls that can delete products, change stock, send test emails, edit settings, and trigger refunds. No such control was exercised.

**User impact.** Anyone who discovers the address can see private business/customer information and may be able to change operational data or trigger external actions. This is a privacy and business-integrity failure even if the deployment was intended as a preview.

**Fix.** Remove the proposal hostname from the open-admin host list immediately. Put the admin on its own hostname behind Cloudflare Access, require the Access token on every admin API call, and make the public storefront return 404 for both `/admin` and `/api/admin/*`. If a clickable demo is required, use a separate fixture database containing no personal data and disable all mutations, email sends, refunds, exports, and uploads. Purge any cached admin HTML after the gate changes.

**Verification.** In a clean signed-out browser, the storefront host must return 404 for admin HTML and APIs. The admin host must redirect to Access, reject missing/invalid tokens, and permit only the intended owner account. Confirm that no cached response reveals data.

### 2. A typed success URL claims payment succeeded and clears the cart

**Evidence.** Visiting `/checkout/success` directly, without a checkout session, displayed “Payment was successful” and cleared the browser-session cart. The route does not validate the `session_id` before rendering success or clearing cart state.

**User impact.** A bookmarked, mistyped, shared, or maliciously linked URL can make a shopper believe an order exists when it does not. It also removes their cart, making recovery harder.

**Fix.** Require a session identifier, verify it server-side with Stripe, and render confirmed success only when the session is paid and belongs to this shop. Use pending, failed, and invalid-session states with clear recovery. Clear the cart only after confirmed payment. Include the real order reference and a support route on the confirmed page.

**Verification.** Direct access without a valid session must not claim payment or clear the cart. Unpaid, expired, and mismatched sessions need safe recovery states. A completed test checkout should show the correct order reference, clear only the purchased lines, and agree with the recorded order.

### 3. The site invents ratings and verification that the review data does not contain

**Evidence.** The reviews page and home page display a 5.0 score, five stars, “verified reviews,” and “verified buyer” on every note. The deployed review feed contains 190 records with no rating or verification field set. The source itself records that these legacy guestbook notes have no star ratings and warns against inventing ratings for structured data, yet the visible interface invents them.

**User impact.** This undermines the strongest trust section on the site and may be misleading. Old guestbook comments can still be valuable, but they cannot support a 5.0 aggregate or buyer-verification claim without evidence.

**Fix.** Remove the score, stars, and verified labels until genuine rating and purchase-verification data exist. Rename the section “Customer guestbook comments” and state the date range/source plainly. Keep the theme counts only if their method is documented and reproducible. When future verified reviews are collected, calculate the score from stored ratings rather than editable copy.

**Verification.** The visible claims, API fields, and structured data must agree. A null rating must render no stars. “Verified buyer” must appear only when a recorded order link or equivalent evidence exists.

### 4. A featured Saltwood Frames journey ends in an empty shop

**Evidence.** The home page promotes Saltwood Frames as one of five primary buyer paths. Its collection page shows zero products and “Nothing in this range just yet.” The admin category is hidden and contains no products.

**User impact.** The most premium-looking home-page route immediately breaks buying intent and makes the proposal look unfinished.

**Fix.** Choose one release state. Either publish the real Saltwood products, category, prices, availability, delivery expectations, and enquiry/purchase action; or remove the buyer-path card and sitemap route until the range is ready. If it is quote-only, replace “Shop the range” with a clear project-enquiry journey and show representative sizes and lead times.

**Verification.** Every promoted home-page path must land on at least one actionable product or a clearly intentional enquiry flow. Add a build/deploy check that rejects promoted collections with zero visible products and no trade action.

## High-priority experience gaps

### 5. Collection rules place products in the wrong journey and hide intended sections

**Evidence.** “Gift sets & offers” in Home and gifts contains an equestrian salt-lick product because the rule accepts every special-deal item. In Kitchen and food, the intended “Cookware & serving” section disappears even though bowls and platters exist; all four products appear only under “Pantry & barware.”

**User impact.** Buyer paths stop doing their main job: reducing choice to relevant products. Gift shoppers see farm stock, while kitchen shoppers cannot distinguish cookware from pantry goods.

**Fix.** Make section membership require both the buyer path and the relevant product purpose. Separate promotional status from merchandising category. Add serving/hosting tags to bowls and platters, then reserve pantry for culinary salt and smaller consumables/barware. Add validation for expected section counts and cross-journey contamination.

**Verification.** Review all five collections from their home card through product detail. Each visible product must belong to the stated buyer need, each configured primary section must contain products or remain intentionally hidden, and the displayed counts must agree with the cards.

### 6. Internal merchandising instructions are published as customer copy

**Evidence.** Every populated collection exposes a “Recommended route” block containing internal directions such as leading with bundles, separating bulk supply, and placing one range after another.

**User impact.** The site speaks like a design document instead of a shop. It adds reading without helping the buyer decide and reduces confidence that the experience is finished.

**Fix.** Keep the internal recommendation in admin/editorial data only. Publish the short customer-facing benefit sentence, or replace the block with a simple “Best for” line and the route action.

**Verification.** Search every public page for editorial terms such as “lead with,” “place after,” “separate,” and “recommended route.” They should appear only in owner tools or internal documentation.

### 7. Returns wording starts the 14-day window too early

**Evidence.** The page says returns must be postmarked within fourteen days of the purchase date. UK government guidance for online goods says customers must be told they can cancel up to fourteen days after delivery, then have another fourteen days to return the item after notifying the seller.

**User impact.** Delivery time consumes the customer's stated window, and the page may deter a valid return.

**Fix.** Have the final policy reviewed for the business, then state the cancellation window from delivery, the notification method, the subsequent return period, refund timing, standard outbound-delivery refund, return-postage responsibility, condition deductions, faulty-goods rights, and genuine exemptions. Keep opened sealed goods exceptions only where the legal exception applies to that specific product.

**Reference.** GOV.UK: <https://www.gov.uk/online-and-distance-selling-for-businesses> and <https://www.gov.uk/accepting-returns-and-giving-refunds>.

### 8. Privacy and terms pages are placeholders rather than usable policies

**Evidence.** Each page is one short paragraph. The privacy page omits the controller details, data categories, purposes and lawful bases, recipients/processors, international transfers, retention, individual rights, consent withdrawal, complaint route, cookies, and the payment/enquiry/newsletter flows visible on the site. The terms omit contract formation, payment, delivery, cancellation, returns, liability, governing law, and other buying terms.

**User impact.** Customers cannot understand how their data or order will be handled, and the business lacks the policy detail expected at checkout.

**Fix.** Replace both placeholders with business-reviewed, plain-English policies. Use layered headings and link the privacy notice beside every form that collects personal data. Name payment, hosting, email, analytics, and delivery recipients actually used by the site; give retention criteria and rights routes. Ensure terms, checkout, confirmation email, returns, and delivery content agree.

**Reference.** ICO guidance lists the privacy information that must be provided: <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/>.

### 9. Product copy contains unsupported health claims and visible quality errors

**Evidence.** Eighteen deployed variants use claims or language around health benefits, air purification, detoxification, wellbeing, antiseptic effects, or moisturising. Customer-facing copy also contains repeated spelling and grammar errors such as “worm glow,” “lenght,” and “Polyurethene.” Testimonials repeat health claims without qualification.

**User impact.** The copy feels imported and unedited, weakens trust, and may turn subjective ambience into objective efficacy claims.

**Fix.** Run a catalogue copy pass. Keep defensible sensory and material benefits such as warm amber light, natural variation, weight, dimensions, care, and use. Remove objective health/medical claims unless the business holds suitable evidence. Preserve testimonials accurately but do not use them to validate efficacy claims; omit or contextualise risky excerpts.

**Reference.** ASA/CAP guidance says objective health and beauty claims require supporting evidence and testimonials do not replace it: <https://www.asa.org.uk/advice-online/substantiation-for-health-beauty-and-slimming-claims.html>.

### 10. Product preview and cart overlays do not take accessibility ownership

**Evidence.** Opening the product preview leaves keyboard focus on the underlying “Choose” button. Opening the cart similarly leaves focus behind the overlay. Neither surface is exposed as a modal dialog in the accessibility tree, and background controls remain reachable. Escape closes the product preview and returns focus correctly.

**User impact.** Keyboard and screen-reader users can lose context or interact with content hidden behind the overlay.

**Fix.** Give modal surfaces a labelled dialog role and modal state, move focus to a sensible first control or heading, make the page behind inert while open, contain Tab/Shift-Tab, support Escape, and restore focus to the trigger. If chat remains non-modal on desktop, announce its expanded state and move focus into the panel; use modal behavior when it covers a small screen.

**Verification.** Complete the preview, cart, and chat journeys with keyboard only and with a screen reader. Focus must never disappear behind an open surface.

## Medium-priority gaps

### 11. “About” opens a manufacturing page

**Evidence.** The persistent navigation label is “About,” but it opens a page headed “From mined rock salt to finished lamps, bricks, bowls, and tiles.” Company information appears later on the page.

**Fix.** Rename the navigation item “How it’s made,” or create a true About page and keep Manufacturing Process as its own footer/header route.

### 12. Catalogue pages flash zero counts before products load

**Evidence.** Shop and category routes initially show zero products and zero counts beside a loading panel, then update to the real totals. The change is visible in the live interface and accessibility tree.

**Fix.** Hide count-dependent summary cards and filters until catalogue data is ready, or render a consistent build-time snapshot and reconcile it without a zero state. Keep layout space stable to reduce the visual jump.

### 13. Delivery cost and timing are missing before checkout

**Evidence.** Product detail and cart show price and subtotal but no delivery estimate, postage range, free-delivery threshold, or dispatch expectation. The product page only directs uncertain shoppers to contact support.

**Fix.** Publish a delivery page and show a concise estimate near Add to cart and subtotal. Once the weight/postage work is complete, calculate the rate before the shopper leaves for payment and repeat it in the payment step and confirmation.

### 14. Missing routes look correct but return a successful web status

**Evidence.** The missing-page view is helpful, but a nonexistent URL returns web status 200.

**Fix.** Serve a real 404 response at the edge while retaining the current recovery design and no-index behavior. Confirm that retired product URLs redirect only when a genuine replacement exists.

### 15. Reports and edit-heavy admin screens need stronger accessibility labels

**Evidence.** Inventory exposes many editable stock fields and the save control without accessible names. Product search and some filters are also unnamed in the accessibility tree. The sales chart communicates mainly through a line with limited axis context.

**Fix.** Associate every input with product, option, and measurement in its accessible name; label filters and save actions; expose tab selection; and give charts a textual summary and meaningful axes. Preserve the current spacious table layout while adding these semantics.

### 16. The mobile navigation pattern needs a live-device pass

**Evidence.** Responsive source rules turn the six-item primary navigation into a horizontally scrolling row at small widths. This session could not set a true mobile viewport, so clipping and discoverability remain partially verified rather than confirmed failures.

**Fix.** Test at 320, 375, 390, and 430 CSS pixels with keyboard and touch simulation. If Contact or About starts off-screen, use a compact menu or a clearly visible horizontal-scroll affordance. Recheck product options, cart, chat, long policy text, and admin tables at the same widths.

## What is already working well

- The home page has a clear primary action, strong product photography, readable hierarchy, and useful buyer-path framing.
- Search has a helpful empty state and an immediate route back to the full range.
- Product pages clearly show option price, sold-out state, natural variation, care, and support.
- Refund and support forms use meaningful labels and move focus to the first missing required field when submitted empty.
- Missing-page recovery is concise and gives two sensible routes forward.
- The admin visual system is consistent and legible on desktop, with good use of spacing, restrained colour, and readable tables.

## Recommended repair order

1. Close and isolate the admin, including caches and preview data.
2. Verify checkout success before claiming payment or clearing the cart.
3. Remove invented review ratings and verification labels.
4. Resolve Saltwood's release state and collection-merchandising errors.
5. Correct returns, privacy, terms, and product claims with business/legal review.
6. Repair overlay focus and admin form semantics.
7. Remove editorial copy, loading flashes, and navigation ambiguity.
8. Complete a true mobile-device and paid test-checkout verification before release.

## Follow-up: proposal Admin loading regression

**Reproduction.** The Admin navigation and page shell loaded on the proposal site, but Dashboard
and every other owner view showed “Not found” because their data requests returned 404.

**Root cause.** The hostname gate had been changed to serve Admin nowhere when `ADMIN_HOSTS` was
unset. The Admin link was later restored without restoring the proposal site's matching access
configuration.

**Data check.** The remote proposal database still contained the catalogue and review data: 35
products, 10 categories, 200 reviews, and three Stripe test orders. No data restoration was needed.

**Repair.** The exact proposal hostname is now named by both `ADMIN_HOSTS` and the proposal-only
`ADMIN_OPEN_HOSTS` owner-review exception. The Wix site, customer domain, and DNS were not changed.

**Verification.** Dashboard, Orders, Products, Categories, Inventory, Reports, Emails, Settings,
and all four Documentation views rendered successfully on both desktop and mobile browser profiles.
