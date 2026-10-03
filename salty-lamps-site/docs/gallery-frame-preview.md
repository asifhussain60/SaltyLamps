# Approved gallery frames — 3 October 2026

## Scope and authorization

Asif requested repository groundwork, review of the parked picture-frame gallery idea for the initial release, and a preview on the test site before acceptance. Work starts from `2089b10`, verified as the latest hosted production deployment. The original checkout was clean and remains untouched. The candidate is isolated on `codex/gallery-frame-preview`.

The approved owner account and current domain attachment were read back with Wrangler. Both `www.saltylamps.co.uk` and `test.saltylamps.co.uk` belong to `salty-lamps-staging`; they share the real database. Preview publication therefore uses the existing live release script, never the staging script. Asif then accepted the displayed local preview and explicitly instructed: "I love it, release it to prod when done". Production publication of this design is authorized. No public-opening action is authorized here.

## Implementation

The initial candidate required the test hostname and an explicit query. After visual approval, that temporary gate and its three tests were removed; the accepted `gallery-mosaic--framed` class now applies by default to the product close-up mosaic in `src/App.jsx`. Scoped CSS provides the outer bevel, recessed rim, equal frame thickness, phone scaling, and distinct keyboard focus. No image assets or dependencies were added. Images, caption text, overlays and links remain inside the framed opening.

The local style catalog and Boomerang card/overlay source were reviewed for balanced surrounds and content separation; the implementation is native project CSS with no theme archive runtime reference.

## Verification

- Initial gated preview: all 258 unit tests passed. Final production candidate: the three temporary gate tests were removed with the gate; the guarded release reruns the remaining 255 tests.
- Production build passed: 119 search files, 76 product pages and 41 referenced media assets verified.
- Read-only catalogue refresh changed only snapshot timestamps; catalogue content was identical.
- Local browser: 24 tiles, wide/standard/tall arrangements, phone width 390, all captions within tile bounds, no horizontal overflow. Real catalogue data served by a temporary GET-only local fixture; no shop writes.
- Final release: all 255 remaining unit tests and the production build passed through `deploy-live.sh`.
- Published code commit `5b23c3b7aeb7bc26c30e94426048bb277c792e1f`, deployment `5f2f3e3c.salty-lamps-staging.pages.dev`, using the pinned live configuration.
- Before publication: private SQL export and Time Travel bookmark saved under `/Users/asifhussain/salty-lamps-private/live-20261003T142206Z`. Export size 15,873,892 bytes; SHA-256 `3611a81b6df1e236123120bc551c98925d2c012801ce98fcb7a6bafe9c837cc3`. No database restore or write was performed.
- Hosted browser verified frames on both `https://test.saltylamps.co.uk/gallery` and `https://www.saltylamps.co.uk/gallery` from the allowed testing connection. All 24 tiles framed; no broken loaded gallery images observed. All names, destinations and ordering matched the pre-release test gallery.
- Hosted desktop and 390-pixel phone checks: no horizontal overflow or clipped captions; phone rails 7 pixels; focused tile has a distinct 3-pixel outline with a 5-pixel offset. Clicking the angel tile opened its product page. No checkout or administrator writes were exercised.
- Screenshots saved under `/Users/asifhussain/.codex/visualizations/2026/10/03/01a1021f-68b8-7c51-9d8b-cb977a65bae8/gallery-frames-desktop.jpg` and `gallery-frames-phone.jpg`.
- Public testing restriction, domain attachments, provider settings and launch gates were not changed. The release script prints historical cutover instructions and a temporary-photo count; those messages are not new evidence that a domain move or photo migration is needed.

## Release decision

Visually accepted and explicitly authorized for production by Asif; suitable for inclusion in the initial release, with public opening governed by the existing launch gates. No database changes, independent test infrastructure or provider work is needed for this styling. The final candidate makes the approved frames the gallery default on both test and customer hosts. Publishing it does not lift the public testing restriction.

The full independent test shop remains parked. The current test hostname must never be treated as safe for disposable orders, administrator edits or write-capable suites.
