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
- Hosted deployment and final browser read-back: pending at candidate commit time; append the outcome after publication.

## Release decision

Visually accepted and explicitly authorized for production by Asif; suitable for inclusion in the initial release, with public opening governed by the existing launch gates. No database changes, independent test infrastructure or provider work is needed for this styling. The final candidate makes the approved frames the gallery default on both test and customer hosts. Publishing it does not lift the public testing restriction.

The full independent test shop remains parked. The current test hostname must never be treated as safe for disposable orders, administrator edits or write-capable suites.
