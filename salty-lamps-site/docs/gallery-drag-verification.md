# Administrator image gallery drag placement

Approved after the inline empty-slot mock on 3 October 2026. Implemented locally;
no hosted data writes or release. This changes image order inside the administrator
product editor, independently of the earlier global shop-order feature.

## Behaviour

- Removed left/right gallery buttons for both existing products and staged images.
- Whole pictures are drag handles. Mouse, touch and keyboard use the existing
  dnd-kit dependency. A floating photo follows the drag, and an empty dashed tile
  marks the insertion position while neighbouring pictures move aside.
- Thumbnails are photo-only. Replace/Delete text controls and the Primary label
  sit underneath; no badges, circles or controls overlay the photos. The small
  instruction above reads “Drag photos to reorder. The first photo is primary.”
  The floating preview is smaller and slightly tilted to keep the empty slot clear.
- Escape or releasing outside the gallery restores the original order without a
  write. A single picture cannot be dragged. Replace/delete remain separate actions.
- Existing images save through the existing protected image-order endpoint on drop;
  failures restore the prior order and permit retry. New-product images only change
  local order until creation. The first saved photo remains the primary image.
- During a save, dragging and image actions are disabled. Customer controls unchanged.

The implementation reuses current brand tokens and the UI catalog's balanced card
borders. It has no runtime dependency on the theme archive. Documentation consulted:
[dnd-kit overlay](https://dndkit.com/react/components/drag-overlay/) and
[sortable state](https://dndkit.com/react/guides/sortable-state-management/).

## Verification

Tests were written first: the arrow-removal test failed with 12 old buttons.
Subsequent checks exposed failed-save rollback and outside-drop preview restoration;
both were fixed and verified. The obsolete arrow-based persistence test now exercises
keyboard dragging, preserving real database/reload coverage.

- Final targeted desktop/phone browser run: **15 passed, 3 device-specific skips**.
  Covers arrows absent, replace/delete retained, pointer slot position and dimensions,
  hidden source image, smaller floating preview, controls below photo bounds, visible
  drag instruction, no writes before drop, reload persistence,
  Escape/outside cancellation, failed-save rollback and successful retry, touch input,
  single-image lock, pending new-product images, upload retry and real primary-photo
  persistence in a disposable local database.
- Complete JavaScript unit suite: **266 passed**.
- Production build: passed, 120 SEO files, 76 product pages, 41 media files verified.
- Complete Python suite under Python 3.13 with openpyxl: **48 passed, 5 failed**,
  matching the earlier baseline failures documented in product-order-verification.md.
- Complete desktop/phone browser run: **308 passed, 8 failed, 2 flaky, 30 skipped,
  6 not run**. Failures concern email image origins, refund rendering, description
  expectations/ambiguous selectors; broader suite is not green. The final outside-drop
  correction was followed by the full targeted gallery run described above.
- No lint command or configuration exists; no lint pass claimed. `git diff --check`
  and checks for forbidden theme-archive references passed.
- Actual local desktop and phone views inspected, including the active drag preview.
  Phone view has no horizontal overflow. Screenshots stored with this chat's visuals.

All write-capable tests used the disposable local database at port 8793. No migration,
import, owner-catalogue reset, live payment or deployment was performed.

## Plain-thumbnail refinement

Asif explicitly chose plain photos with controls and Primary underneath after
clarifying that the supplied reference still showed circles. Added the requested
small drag instruction. Both the overlay-size test and below-photo-control test
failed before the refinement; final targeted run: 15 passed, 3 device skips.
Build and all 266 JavaScript unit tests passed again. Python: 48 passed, the same
5 baseline failures. Desktop/phone screenshots of the actual local demo confirmed
plain photos, separate text actions, readable instruction and no phone overflow.

A hidden, six-image local demonstration product was created only in the disposable
local database: `product_45c95709-2f58-4c6e-b877-97342c5bce74`. The original local
bulb product has one image and cannot demonstrate reordering. No owner data changed.

Final plain-thumbnail full browser run: 310 passed, 8 failed, 30 skipped, 6 not
run; no flaky passes. The same eight email-image/refund/description failures remain.
Targeted gallery accessibility scan (WCAG 2/2.1 A/AA): zero violations.
Asif authorized publication after completion. Approved owner-account identity and
read-only catalogue refresh verified before release packaging.
