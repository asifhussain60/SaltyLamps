# Owner checkout complaint investigation — 28 September 2026

> Current status: repairs published to protected test/admin on 28 September 2026. Manual checkout is verified through actual Stripe test payment. Address-provider activation and owner physical-device loading acceptance remain open. Earlier sections below record the original investigation; the repair section supersedes their pending statuses.

## Scope and environment

Investigated the protected `https://test.saltylamps.co.uk` shop and its associated `https://admin.saltylamps.co.uk/admin` test administrator in the signed-in Chrome browser. Source checkout: clean `develop` at `b54379c7372efddcaecea1b363cfa27e6d9bbeed` before this report. No remote configuration, source implementation, production data or provider settings were changed. No payment was submitted or email sent. One unpaid sandbox checkout session was created to verify the payment handoff.

## Confirmed findings

| Complaint | Evidence | Diagnosis | Status |
| --- | --- | --- | --- |
| No list of house numbers or addresses after entering a postcode | Live address page has plain address fields and a postcode combobox. `CheckoutAddress.jsx` uses `PostcodeTypeahead.jsx`; `/api/postcode-suggestions` reads only postcode strings from `uk_postcodes`. There is no property-address lookup integration in this flow. | Postcode suggestions were previously confused with full address lookup. The latter is not implemented. The staging bootstrap supplies only SW1A 1AA and SW1A 2AA as postcode suggestions. | Confirmed missing capability; not repaired. |
| Manually entered address cannot proceed to payment | Angel Shape lamp, quantity one, synthetic name/email/street and postcode ST4 3NP produced “We could not prepare delivery for this order. Please try again.” All required fields passed browser validation. | Live administrator Delivery settings contain one zero-cost sandbox rule, group `sandbox`, country GB, postcode prefix `SW1A`, weight over 0 kg through 1000 kg. ST4 has no matching delivery rule. `prepare-staging-bootstrap.py` deliberately installs that restriction; the checkout endpoint rejects the unmatched quote before creating payment. | Reproduced and root cause verified; test configuration unchanged. |

## Controlled comparison

Kept the same item, quantity and synthetic address fields; changed only the postcode to SW1A 1AA. The checkout advanced to step three and the actual embedded Stripe form displayed Test Mode and card-entry controls. No card information was entered and Pay was not selected. This establishes the postcode restriction as the cause for this reproduced basket; it does not establish that every item, postcode or payment journey passes. The owner's exact basket/postcode was not supplied.

## Evidence

- `salty-lamps-site/outputs/checkout-owner-complaint-2026-09-28/delivery-restriction.png`: signed-in test administrator showing the sole SW1A rule.
- `salty-lamps-site/outputs/checkout-owner-complaint-2026-09-28/payment-loaded.png`: actual test-shop embedded Stripe payment form after the postcode-only change.
- Source: `src/components/CheckoutAddress.jsx`, `src/components/PostcodeTypeahead.jsx`, `functions/api/postcode-suggestions.js`, `functions/api/checkout.js`, `functions/lib/weights.mjs`, `scripts/prepare-staging-bootstrap.py`.

## Recommended repair scope

1. Broaden the clearly labelled sandbox delivery rule to accept ordinary GB test postcodes, retaining sandbox-only Stripe and email dry-run. This is not approval of production shipping prices or delivery coverage. Recheck the formerly rejected postcode and sample postcode through the actual payment handoff.
2. Integrate a real UK property-address data service for selectable houses/flats; keep manual entry working when lookup has no results or fails. Provider choice, credentials and any subscription remain unresolved; no provider was activated.
3. Explain non-deliverable destinations before the payment action and distinguish address lookup from postcode suggestions. Do not bypass delivery validation or represent synthetic rates as approved live rates.

Investigation is complete for the reproduced case. Repairs and publication remain pending.

## Mobile loading complaint and responsive audit — follow-up

Owner reported repeated failure to load on mobile. Asif clarified iPhone and requested coverage for Android and other mobile devices. Exact phone model, operating-system/browser version, entered URL, network and failure-screen state were not supplied. The protected test hostname was used, consistent with the original complaint. This investigation does not establish a cause for the owner's specific failure.

### Current evidence

- Signed-in Chrome successfully loaded the deployed home and shop pages at phone widths. Home/shop/product direct reloads were exercised; shop displayed all 33 product cards after catalogue loading.
- Eight viewport configurations were used: 320×568, 360×800, 390×844, 430×932, 844×390, 768×1024, 1024×768 and 1440×900. These are desktop Chrome viewport overrides, not real iPhone Safari or Android Chrome devices. Not every route was checked at every size; exact coverage is recorded below and in the JSON evidence.
- Phone navigation menu opened and the Shop link worked. Search/filter expansion and an `angel` search returned one matching product. Product navigation, Add to cart, checkout review, postcode suggestion selection and address carry-forward worked.
- At 390×844, synthetic address details and SW1A 1AA reached the actual embedded Stripe Test Mode card form. The form was then inspected at five sizes. No card details were entered, no payment was submitted and no customer email was sent. This follow-up created one additional unpaid sandbox session.
- The landscape cart was scrollable: its Checkout button could be reached and activated at 844×390. It opened order review. A button below the initial fold is not logged as an inaccessible-control failure.
- Across 51 route/viewport observations, measured document width did not exceed the viewport; open cart drawers stayed within their containing screen. No application-origin console error was captured. Browser-extension errors were excluded. Hidden off-canvas cart controls found by the initial shop DOM scan are not visible-layout defects.
- Fresh unauthenticated HTTP requests with desktop, iPhone Safari and Android Chrome user-agent strings all returned the same expected Access sign-in redirect for HTTPS home/shop. HTTP home redirected to HTTPS. User-agent headers alone do not emulate mobile browsers or establish mobile compatibility.
- A separate in-app browser without an active test-shop session reached and rendered the Cloudflare sign-in screen at 390×844. It did not load the shop without signing in. Owner credentials were not entered; owner phone sign-in and any device-specific redirect/cookie/network problem remain untested. Authentication must not be bypassed or weakened as a speculative repair.

### Coverage matrix

| Surface | Viewport widths inspected | Result |
| --- | --- | --- |
| Home | 320, 360, 390, 430, 768, 844 landscape, 1024, 1440 | Loaded after reload; no horizontal overflow |
| Shop | 320, 360, 390, 430, 768, 1024, 1440 | Loaded 33 cards after reload; no horizontal overflow |
| Product | 320, 390, 768, 844 landscape, 1024, 1440 | Loaded after reload; Add to cart available |
| Open basket | 320, 390, 768, 844 landscape, 1440 | Drawer fits; landscape Checkout reachable by scrolling |
| Order review | 320, 360, 390, 430, 768, 844 landscape, 1024, 1440 | Fits; phone postcode selection and next step worked |
| Delivery address | 320, 360, 390, 430, 768, 844 landscape, 1024, 1440 | Fields fit, 16px input text; payment handoff worked at 390 with sample postcode |
| Embedded test payment | 320, 390, 768, 844 landscape, 1440 | Test form loaded; outer page/frame fits; no payment submitted |
| Gallery | 320, 390, 768, 1440 | Loaded after reload; no horizontal overflow |

### Updated fix and investigation list

| Priority | Item | Evidence status | Required outcome |
| --- | --- | --- | --- |
| High | Owner's iPhone cannot load the test site | Owner-reported; not reproduced in available browsers. Fresh sign-in is a separate acceptance gap, not a proven cause. | Reproduce on actual iPhone Safari and Android Chrome, including fresh/expired sign-in, direct link, reload and Wi-Fi/mobile data; identify the failing stage before choosing a repair. Keep open until the owner's path works. |
| High | Ordinary postcodes cannot reach payment | Confirmed earlier; only SW1A has a sandbox delivery rate. | Apply a reviewed sandbox-only delivery coverage change and retest the formerly failing address. |
| Medium | No house/flat address dropdown | Confirmed missing integration. | Connect an approved UK property-address lookup and preserve manual fallback. |
| Medium | Missing delivery quote is explained too late | Confirmed earlier at the address-to-payment action. | Give an actionable explanation before the shopper completes the address step. |
| Low | Header branding breaks into three lines at 320px | Reproduced visually: “Salty / Lamp / s”. Mobile CSS allows arbitrary word wrapping while cart/menu consume the remaining width. | Keep brand text legible without breaking words and preserve usable menu/cart controls at the narrowest supported width. |
| Hardening candidate | App startup lacks a visible load-failure recovery path | Source inspection only: entry renders into an empty root; no application error boundary or startup retry UI was found. Not proven to explain this complaint. | Evaluate blocked/stale scripts and interrupted loading; if reproduced, show a useful retry state instead of leaving a blank screen. |

Evidence is in the existing ignored output directory: `viewport-results.json` and `home-*`, `shop-*`, `product-*`, `cart-*`, `review-*`, `address-*`, `payment-*`, `gallery-*` screenshots. `shop-320.png` and `review-320.png` show the narrow-header defect; `payment-390.png` shows the actual test payment form. Temporary viewport overrides were reset. No source repair, remote setting change or deployment occurred. This is an investigation and updated repair list, not an all-device compatibility sign-off.


## Repair and publication — 28 September 2026

### Implemented and verified

- Removed the accidental `SW1A` restriction from the sole live **sandbox** delivery rule through test administration, saved and reloaded it. Blank prefixes now provide the GB fallback. Label, zero test charge, postal group and weight range retained. Updated the synthetic bootstrap to match; no database reseed or customer import occurred.
- Added server-side Ideal Postcodes property-address lookup, native house/flat selection and field population. Missing configuration, no results, timeout or provider failure leave manual entry available. Cancellation prevents stale postcode results. Provider key is never returned to the browser.
- Moved postcode before address fields, explained lookup/manual entry, and exposed unavailable delivery on order review before completing the address step.
- Added a standalone startup status/reload script and React error boundary. Verified blocked application scripts on shop and directly loaded nested checkout routes. Fixed generated page shells to use an absolute recovery-script URL.
- Corrected the 320px header branding wrap.
- Found an additional reproducible WebKit defect: native cart option controls and their parents retained computed `visibility:hidden` after opening, despite visible geometry. Four iPhone/iPad tests failed before repair. Replaced inherited visibility toggling with opacity while preserving off-screen placement, `inert`, `aria-hidden` and pointer blocking when closed. All four then passed without weakening test actions or assertions.

### Publication evidence

- Approved Cloudflare owner account: `e35d5918c507bc2cf4e920fe38b5e318`, displayed `Saltylamps@hotmail.com's Account`.
- Project `salty-lamps-staging`; database binding verified before publication as test DB `981a6d7b-8eb7-4057-8023-d2a4894c21e4`.
- Successful deployment: `c0d51955-7395-4149-9b5f-e1cdb6b76243`; dashboard explicitly reports **success** and aliases `test.saltylamps.co.uk`, `admin.saltylamps.co.uk`.
- Both custom hosts observed loading `/assets/index-CsuXPwaD.js` and `/startup.js`, with startup panel hidden once ready. Administrator settings loaded successfully after refresh.
- Release archive: `outputs/checkout-owner-complaint-2026-09-28/repair-release.zip`, 381 files, SHA-256 `5763c1240a06593b7ea9ad57a7b2f90d61b61b6077f2fbc86baad5f6a2fb64b2`.
- First upload `ef49c67f-50c7-484a-be1f-f41b09b587dc` failed; prior deployment kept serving. Cause: current Wrangler `pages functions build --outfile` emits multipart upload data, which is not a runnable `_worker.js`. Corrected by `--outdir /tmp/salty-repair-worker`, copying emitted `index.js` to `dist/_worker.js`, checking JavaScript syntax and running that bundle locally. Subsequent upload succeeded. Future dashboard uploads must use the plain module, not the multipart envelope.
- Previous known-good deployment for rollback: `b4ec4cc2-af0c-44ea-9dcf-c4a8e3533b8c`. Delivery-setting rollback is separate; previous prefix was `SW1A` and should not be restored except intentionally.

### Verification performed

- Build, Worker compilation/syntax and staging isolation preflight passed.
- 165 unit tests passed; staging preflight regression checks passed (2).
- Initial desktop/Pixel browser run: 34 passed. After Safari CSS repair: 22 affected desktop/Pixel checks passed.
- Final iPhone 13 and iPad WebKit run: 34 passed. After absolute startup URL correction: 4 blocked-script checks passed across shop/nested address routes and both Apple profiles.
- Actual published phone-width journey: Angel Shape lamp, quantity 1, `ST4 3NP`, synthetic `Checkout Test`, `buyer@example.com`, `10 Test Street`, Stoke-on-Trent. Manual entry reached step 3 and the real embedded Stripe **Test Mode** card form. No card data entered, payment submitted or customer email sent. One unpaid sandbox session was created in this repair verification.
- Published payment layout measured at widths 320, 390, 768, 844 landscape and 1440 without document horizontal overflow; frame fits. Local repaired shop header visually inspected at 320px.
- Unauthenticated curl requests to test/shop and admin/admin returned 302 to the expected Cloudflare Access hostname. Public `www.saltylamps.co.uk` returned its existing 503 holding-page content. Bare Python requests were rejected with 403 and were not treated as site failures; curl verification established expected behavior.
- Screenshots: `repaired-payment-390.png`, `repaired-admin.png`, `repaired-delivery-setting.png`, `deployment-success.png`. Viewport observations: `published-payment-viewports.json`. All are under the report's existing ignored evidence directory.

### Remaining acceptance gaps

| Item | Current status | Required to close |
| --- | --- | --- |
| Real house/flat address dropdown | Integration published and tested using controlled provider responses. Live lookup explicitly reports not connected; no provider key exists in staging. | Owner's approved provider account and server-side credential, followed by real postcode lookup on the published site. Do not put secrets in chat. No subscription or spend has been authorized or activated. |
| Owner's original mobile page-load failure | Not reproduced on available live browser. Safari cart defect repaired; loading recovery and iPhone/iPad/Android-style checks passed. These do not prove the reported device/sign-in/network path. | Actual owner iPhone and Android fresh sign-in, reload and checkout acceptance. Preserve Access protections. |

Public launch, production payments, customer email and production shipping approval remain outside this release. Source changes remain uncommitted in the existing checkout; deployment bundle/evidence identify the published state.

## Final postcode-only scope and release — 28 September 2026

The owner subsequently confirmed that mobile now loads and desktop checkout can complete, while postcode suggestions remained outstanding. Asif narrowed the address request: use postcode typeahead and keep the checkout address tied to that postcode. A national house/flat directory and paid address-provider activation are no longer part of this release. The Wix export contains historical customer/order addresses, not a licensed national premise directory; none were copied into the shop's postcode table.

- The order-review postcode combobox starts suggesting after one character. The test Worker queries the public Postcodes.io autocomplete service for up to eight allocated postcode suggestions and uses the existing small D1 postcode table as an outage fallback. No customer data or new address table was imported. Northern Ireland `BT` suggestions are omitted because that data needs a separate licence; syntactically valid `BT` postcodes can still be entered manually.
- The input accepts UK postcode characters, normalises spacing and validates a complete UK postcode before address/payment. The address step displays the selected postcode read-only and offers **Change postcode** to return to review. Changing it clears previously entered street/town details. The checkout handler checks the chosen postcode against the address again before creating payment; the server independently validates UK postcode form. Manual house/flat, street and town entry remains available.
- This lock ensures the postcode sent with the order is the one used for the delivery quote. It does **not** establish that a manually typed house/flat or street actually belongs to that postcode. That would require licensed premise-level address data. Postcode syntax also does not prove that a manually entered code is currently allocated.
- Local checks: 170 unit tests passed; 28 focused desktop/mobile browser tests passed; two checkout retry tests passed; build, Worker JavaScript syntax, staging-isolation preflight and `git diff --check` passed.
- Final release archive: `outputs/checkout-owner-complaint-2026-09-28/postcode-final-release.zip`, 381 bundled files, SHA-256 `55ea0876dc5e9e40a6bc7287494e25982a3d5f6de5f96c06e8b0e37445c82348`.
- Published to approved owner account's protected `salty-lamps-staging` Pages project. Deployment `03553258-054c-42e7-ba0a-0a08d7ad4a1d` reports **success** and aliases both `test.saltylamps.co.uk` and `admin.saltylamps.co.uk`. The preceding good staging deployment is `fe3f4569-1d5f-41d0-bdd1-5befa5663c64`.
- Both signed-in hostnames loaded the final client bundle `/assets/index-BqpEhQmZ.js` and `/startup.js`.
- Signed-in published checkout: first-character `S` returned eight actual suggestions; `ST43` narrowed to `ST4 3..`; `ST4 3NP` produced the free sandbox delivery quote and a read-only address postcode. Synthetic `Checkout Test / 10 Test Street / Stoke-on-Trent` continued to the real embedded Stripe **Test Mode** form. No card data or payment was submitted. One unpaid sandbox session was created. Admin settings loaded on the protected admin hostname.
- On the same published basket, **Change postcode** returned to review; replacing `ST4 3NP` with `SW1A 1AA` recalculated delivery, kept the new postcode read-only on address and cleared the old street/town fields.
- Published address view measured at 320, 390, 768 and 1440 pixel widths: document width equalled viewport width in each case and the postcode remained read-only. Earlier focused browser coverage included desktop, mobile and WebKit profiles. This is responsive browser evidence, not a claim that every physical iPhone/Android model was tested.
- Fresh signed-out requests to test shop and admin routes still returned the expected Cloudflare Access sign-in redirect; the public `www` hostname remained on its existing holding response. Production shop, live payment, email and customer-data migration were untouched.
