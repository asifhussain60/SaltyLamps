# Salty Lamps customer-experience and repository audit

Date: 19 September 2026. Baseline: clean `develop`, commit `d80e54d`.

## Outcome and scope

Implemented and locally verified the defects identified below. This is a source and rebuilt-application audit, not a production release or a certification of universal accessibility compliance. The customer's attached conversation was treated as evidence of shopping problems, not as authority to remove necessary shipping checks or change courier prices.

Reviewed the storefront, catalogue/options, cart, payment handoff and confirmation, enquiries/returns, administration, weights/postage, exports, authentication boundaries, content generation, dependencies, tests and deployment guidance. Existing storefront typography, colours and component patterns were retained; commerce references in the owner's style catalogue informed spacing and control layout. No runtime dependency on that archive was introduced.

The user explicitly requested fixes, so implementation was already authorised. Production data, courier charges, customer domains, secrets, external email, payments and deployment were not changed. Protected source documents, backups, media and the frozen proposal were preserved. No audit waivers were applied (the waiver registry is empty).

## Findings and changes

| Severity | Surface | Finding and customer impact | Fit and resolution |
| --- | --- | --- | --- |
| P1 | Cart and catalogue | Repeated clicks were required for bulk quantities, and the public stock response artificially capped available stock at 20. | Accept. Added labelled editable quantities, whole-number/stock validation, 44-pixel step controls, explicit removal and line totals; expose actual stock availability. |
| P1 | Delivery and checkout | The old calculation required a rate for the entire basket as one parcel. Orders over its maximum fell into a quote-required state despite potentially fitting several parcels. | Flag resolved in code through an explicit owner setting. Added optional multi-parcel calculation using saved packed weights and existing rate bands. It remains off by default until the courier rule is confirmed. |
| P1 | Cart delivery feedback | Customers discovered unsupported delivery only when trying to pay; estimates could not be inspected alongside quantities. | Accept. Added a server-calculated estimate that refreshes with quantity changes, states packed weight and parcel count, and offers retry/contact recovery. Checkout waits for a valid estimate and independently recalculates it. |
| P1 | Checkout input | Duplicate submitted lines could bypass the per-line stock check; hidden products were not excluded by the checkout query. | Accept. Shared trusted cart loading consolidates duplicates, checks whole quantities, current price, visibility and stock, and bounds request size. Errors preserve the basket. |
| P1 | Payment callbacks | Completed sessions were accepted without explicitly requiring paid status and the shop marker. | Accept. Process only completed, paid sessions for this shop; support asynchronous payment success too. Existing webhook signature verification, idempotency and both shipping-address field locations remain. |
| P1 | Paid confirmation | Revisiting an old successful checkout could clear a newer basket. | Accept. Reconcile only a matching pending checkout once, subtract its purchased quantities and retain subsequent additions. |
| P1 | Enquiry forms | Failure could be presented as success and discard entered text; customer messages were copied into persistent browser storage. | Accept. Await acknowledgement, prevent repeated submits, retain fields on failure, show announced recovery messages and remove that persistent copy. Covers trade, newsletter and chat. |
| P1 | Administrator access | A configured public shop hostname could also be accepted as an open admin host; malformed/missing token expiry was not explicitly rejected. | Accept. Public-host exclusion and finite required expiry. Deliberately open proposal-host behaviour remains as configured. |
| P1 | Spreadsheet exports | Customer-controlled strings could be interpreted as spreadsheet formulae. | Accept. Prefix formula-like strings safely while preserving actual numeric values. |
| P1 | Dependencies | Initial package audit reported 11 known vulnerabilities. | Accept. Updated Vite, Sharp and affected dependency paths; final application and test-package audits report zero known vulnerabilities. |
| P2 | Returns | Confirmation and email displayed different reference lengths. | Accept. Standardise new references and allow lookup of both historic forms with the matching customer email. |
| P2 | Mobile/shop layout | Crowded product cards, excessive space before products, weak selection treatment and small/awkward quantity controls. | Accept. Wider responsive cards, compact mobile catalogue header, collapsible search/filter panel, balanced selection borders and clearer cart layout. |
| P2 | Keyboard and contrast | Focus could return to an unusable target after switching dialogs; the home review action had insufficient contrast. | Accept. Restore usable focus, add clear control focus/error states, and use dark text on the amber action. |
| P2 | Returns form | Floating chat overlapped the submit area on a narrow screen. | Accept. Remove the redundant floating chat on the dedicated support-request page; the support form and email routes remain available. |
| P2 | Product search metadata | Loading the live catalogue temporarily replaced prerendered Product data with generic Store data. | Accept. Preserve the product metadata until live catalogue resolution. |
| P2 | Build content provenance | Reusing the committed snapshot stamped old content as newly fetched. | Accept. Preserve its original provenance and age when falling back. Final verification used the committed snapshot deliberately. |
| P2 | Test isolation | Supplying a local target still launched an unnecessary second backend; identical weight fixtures from concurrent browser projects could collide. | Accept. Respect the explicitly supplied target and use distinct per-project fixture names. Final regression ran serially because existing admin suites share settings. |

## Shipping rules and release boundary

Weights are multiplied by ordered units and grouped by postal group. With multiple parcels enabled, whole items/packs are allocated within the applicable parcel capacity; individual items are never divided. Matching full-basket bands take precedence. Missing weights, missing bands, unsupported destinations and items heavier than the allowed parcel remain reviewable failures. Rates are bounded and no missing band or price is guessed.

Isolated examples used a **fictional** 3.5 kg packed item, 10 kg maximum parcel and £6.50 parcel charge: two items produce one parcel (£6.50), four produce two (£13), and twelve produce six (£39). These demonstrate the calculation only; they are not verified Salty Lamps courier charges or product weights. The packing algorithm is a conservative whole-item, descending-first-fit calculation, not a dimensional packing optimiser or a guarantee of the cheapest possible courier allocation.

Before release, the owner must confirm whether larger orders use several existing-price parcels or a separate heavier-order tariff, and verify the real packed weights and delivery bands. Online checkout currently uses blanket Great Britain rates; postcode-restricted rates remain for internal quotation. Do not enable multiple parcels where the courier contract does not permit this model. Removing the quote warning without a valid charge was rejected because it would leave delivery unpriced.

## Verification

- Baseline: 57 unit tests and the production build passed before changes.
- Final unit tests: 68 passed.
- Final production build: Vite 6 completed; media references verified; 103 prerendered route shells generated from the preserved committed content snapshot.
- Browser regression: see the final result recorded below. Tested the built frontend against real local Pages Functions and a disposable D1 database, not a static browser mirror.
- New accessibility checks cover 11 routes and the editable cart at desktop (1440 × 1000) and mobile (390 × 844), with zero automated WCAG A/AA violations or page-width overflow in the sampled states. Screenshots were reviewed for layout; quantity validation, delivery recovery, modal focus, empty/search recovery and form failure/success were exercised separately.
- Checkout integration tests inspect the payment request for two, four and twelve items, including trusted prices and shipping charges. Tests cover duplicate stock, missing weights/rates, indivisible packs, mixed postal groups, safe reference lookup, export formula handling and paid-cart reconciliation.
- Application and test-package `npm audit` scans: zero known vulnerabilities. `git diff --check` passes.

The disposable local database used seed data, migrations and sample media references. An existing catalogue-shape guard in migration 010 does not accept the legacy seed unchanged; that guard was not removed and no production migration was run. Local email was disabled and external services were not given credentials. Enquiry error/success tests use controlled responses; Stripe session creation is mocked. No real charge, refund, message delivery, production hostname/access-policy check, long manufacturing-film playback or external legacy redirect crawl was performed. Those checks are not claimed as passed.

The repository still has operational considerations outside these code fixes: documentation mirrors lack a shared consistency fixture, the historical seed/migration path requires deliberate catalogue reconciliation, and licensed media remains tracked in Git under the owner's protected boundary. These were not grounds for destructive restructuring. Automated accessibility tests also cannot replace assistive-technology testing, real-device checks or production performance measurement.

## Sources consulted

Consulted 19 September 2026. Native numeric input behaviour and labelled keyboard controls follow the [WAI spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/). Dialog focus and restoration were checked against the [WAI modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [keyboard-interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/). These are design references, not a claim that automated testing proves complete compliance.

Dependency remediation was checked against the official [Vite security advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff) and [Sharp security advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c). Checkout continues to supply [Stripe shipping options](https://docs.stripe.com/payments/checkout/custom-shipping-options) from trusted server calculations.

## Final browser result

180 browser checks passed, 22 intentionally skipped, zero failed and zero interrupted. The skips cover deployment-specific hostname checks, the external legacy-redirect crawl, long film playback and inapplicable desktop-only/mobile-only journeys. No retries were used in the final run. All eight weight-administration and option-selection checks passed across desktop and mobile.

Local review evidence is saved under `salty-lamps-site/outputs/repo-audit-2026-09-19/`: `mobile-cart.png`, `desktop-shop.png`, `mobile-shop.png`, `mobile-returns.png`, the final build/unit/browser logs and the two dependency reports. Shipping amounts shown in the screenshots use the fictional fixture described above. The temporary `.visual-qa` capture directory was removed after review; no screenshot assets are imported into the application.

## Proposal publication and Asim checklist

Following explicit approval to deploy, the audited fixes and the new `/admin/asim-test-suite`
page were published on 19 September 2026 to `https://salty-lamps-proposal.pages.dev`.
Deployment: `8cef7247`; previous rollback deployment: `538421db-f864-417c-add7-caa648a04579`.
The checklist contains 35 full checks and 14 quick checks, separate device results, browser-local
progress, setup guidance and copy/download summaries. It never submits orders or messages itself.

Verification for this publication: 68 unit checks, 55 local browser checks (one inapplicable
desktop check skipped), and 14 hosted checklist checks passed. Desktop and mobile layouts and
automated accessibility were checked. Hosted Admin and settings endpoints return 200.
All 10 saved delivery rates and all shop settings remain unchanged; multiple parcels remains off.
`PUBLIC_HOST=www.saltylamps.co.uk` was added on the proposal project to distinguish the customer
hostname from its checkout-return address and retain the deliberate proposal Admin access.
The proposal now sends `noindex, nofollow`. No database migration or customer-domain deployment
was performed. Publication evidence is in `outputs/asim-test-suite/`.
