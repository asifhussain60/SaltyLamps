# Administrator product ordering

Implemented locally on 3 October 2026. Not deployed; no hosted database writes,
catalogue imports, payment actions or public opening were performed.

## Accepted scope

Asif approved proceeding after the visual proposal and clarified that editing must
be administrator-only. Products → Shop order offers dragging, up/down buttons,
keyboard movement, a draft preview, Save and Discard. One global order supplies
Featured sorting and the relative product order inside categories and collection
sections. Section headings retain their configured order. Explicit customer price
and name sorting still work. Availability does not override the selected sequence.
Hidden products retain their place without appearing publicly; products added
after a save follow the saved sequence. Options remain grouped under their product.

## Implementation

- The protected `/api/admin/products/order` route inherits existing administrator
  authentication and host restrictions. No customer write route or controls exist.
- A JSON `product_display_order` settings record stores ordered product IDs and a
  revision. No schema migration, product rewrite or catalogue bootstrap is needed.
- A single guarded SQL write checks both the revision and complete current product
  membership. The audit insertion shares its atomic batch. Stale saves return 409;
  a failed batch rolls back. A request ID makes lost-response retries idempotent.
- The shared product query applies the ordering to the public API, content snapshot
  and SEO generation. The public response remains uncached. Product prices, stock,
  descriptions, visibility, images and variant data are not written by reordering.
- The editor uses the current `@dnd-kit/react` and helpers packages, in the existing
  lazy administrator bundle, with touch, pointer and keyboard input. It retains the
  project's navigation guard and catalogue-change announcement. A fixed mobile save
  bar remains visible for long lists. All draft products participate in a save;
  search filters and pagination cannot accidentally omit records.

References consulted: [dnd kit React](https://dndkit.com/react/quickstart/),
[sortable state](https://dndkit.com/react/guides/sortable-state-management/),
[Cloudflare atomic batches](https://developers.cloudflare.com/d1/worker-api/d1-database/).
The approved visual follows existing brand tokens and the local UI catalog's
balanced table/row treatment. There are no runtime references to the theme archive.

## Verification

| Check | Result |
| --- | --- |
| New unit tests before implementation | Six failed for absent behavior; existing auth check passed |
| New ordering unit tests after implementation | 7 passed, including real SQLite queries, invalid/stale requests, rollback, retry, hidden/new/deleted products, variants and protected routes |
| Complete JavaScript unit suite | 266 passed |
| Actual production build command | Passed; 120 SEO files, 76 product pages and all 41 referenced media files verified |
| Dedicated desktop/mobile browser suite | 11 passed; 3 intentionally inapplicable device cases skipped |
| Browser coverage | Pointer, touch and keyboard dragging; arrows; preview; Save/Discard; fresh reload; failed saves; stale-order recovery; unsaved-navigation guard; accessibility; long phone catalogue; no customer editor |
| Real local database/browser journey | Save and retry passed; public feed matched preferred order and omitted hidden products; actual shop Featured/Name sorting passed; competing saves returned 200/409; all product details were unchanged; disposable sequence restored |
| Visual inspection | Actual administrator at 1440×1000 and 390×844; no horizontal overflow; save controls within both viewports |
| Syntax and whitespace | `node --check` on new server modules and `git diff --check` passed |
| Lint | No lint command or lint configuration is provided by this project; no lint pass is claimed |

All write-capable verification ran against a disposable copy of the pre-existing
local database. Missing existing local migrations for product introductions and
order notes were applied to that copy only. The owner's hosted data was not used.

## Broader-suite limitations

The full Python suite ran under a current Python interpreter with openpyxl: 53
tests, 48 passed and 5 failed. The same five failures reproduced using unchanged
HEAD source in an isolated baseline: workbook row offsets, production import
verification counts, catalogue rehearsal counts, missing-photo counts and historical
price-correction counts. Their scripts/data/tests were not changed by this feature.

The complete desktop/mobile browser run finished with 287 passed, 10 failed,
5 flaky, 25 skipped and 9 not run after serial failures. A focused baseline run of
the affected areas against unchanged HEAD reproduced refund display, description
expectations/ambiguous selectors and a frames-page failure (7 failed, 5 passed).
Email image failures in the broad run used the old local email origin on an inactive
port; these passed in the isolated baseline with its correct local origin. Browser
closures also affected the broader run, including the mobile weight test; that test
passed in the isolated baseline. These results do not justify claiming the complete
site regression suite is green. No unrelated tests were removed or weakened.

The dependency audit also reports eight existing findings in build-tool dependency
chains; none identifies the newly added drag-and-drop packages. Unrelated dependency
upgrades were not included.

## Release boundary

This is a local implementation for review. A hosted code release still follows the
existing owner-account rules: dated private export and Time Travel bookmark, approved
live release path, and the required business authorization. Public opening remains
separate from shipping these administrator controls.
