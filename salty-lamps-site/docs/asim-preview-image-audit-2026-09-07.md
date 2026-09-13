# Product previews and lighter imagery: investigation

Date: 7 September 2026. Status: investigation complete; implementation and regeneration not performed.

## Scope and evidence

Reviewed the current `develop` working tree, recent history and change hotspots, storefront routing and selection, catalogue transformation, database schema, admin image and option editing, image upload/replacement/deletion, content snapshots, image optimisation, search metadata and existing tests. Verified shopper behaviour in Chrome against https://salty-lamps-proposal.pages.dev, including desktop and a 390 × 844 phone viewport. This is the deployed test site, not a claim of production-domain verification.

The working tree already contains the Saltwood Frames rename, video changes and other uncommitted work. These were left intact. Current source, snapshot and the observed homepage all use Saltwood Frames. Historical rename notes were used only for orientation; current evidence controls this report.

Public catalogue, content and category responses were inspected without editing remote data. The image inventory combines those responses with literal image references in the current storefront. It is a candidate regeneration inventory, not a claim that every referenced image is currently painted on screen. Logos, font files, frozen proposal materials, historical backups, hidden database products and video frames are outside that count.

## Findings, ordered by impact

| Priority | Finding | Evidence | Fit and proposed resolution |
|---|---|---|---|
| P1 | Options have no individual image association | `d1/schema.sql` stores the image on products; neither `skus` nor `product_images` links a photo to an option. `functions/lib/flatten-products.mjs` selects `p.image` and deliberately shares the gallery. All 13 multi-option products in the public response have one shared primary photo. | Accept: add an optional option-to-gallery-image association with product-photo fallback, expose it through the shared catalogue transform, and make it editable in admin. |
| P1 | Quick view reads the group's default image | `src/App.jsx:2343` renders `quickViewProduct.image`, while price, cart and full-details link use `quickViewVariant`. | Accept: derive the popup image and alternative text from the selected option. This must accompany the data change; by itself it produces no visible difference with today's shared images. |
| P1 | A different shape can be represented by the wrong photo | Browser: the selected 8-inch round platter displays the square sushi platter photograph. The problem also affects shape and pack options, not only size. | Accept: create and assign accurate option images. A cosmetic zoom of one shared photo cannot represent square versus round, different stone shapes or pack quantities. |
| P2 | Gallery thumbnails do not control the main preview | `src/App.jsx:1658` maps images directly into plain image elements, without buttons or selection handlers. Clicking the platter support image left the primary image unchanged in Chrome. | Accept: accessible thumbnail buttons, selected-image state scoped to the current option, and a reset to the option's main photo when the option changes. |
| P2 | Fallback gallery photos are generic merchandising images | `detailImagesFor` falls back to theme photos when the product has no additional gallery image. The platter showed a mixed saltware range and a kitchen scene. | Accept: label contextual images as lifestyle inspiration, and use product-specific images for the selectable product gallery. Do not present an unrelated product as another view of the chosen option. |
| P2 | Image sources and display effects both create the darker appearance | Original natural-lamp photo has a black background; its generated counterpart has a cream background but intensely orange salt. Saltwood living-room imagery is deliberately dim and amber. Product-card CSS adds saturation and an amber overlay; trade imagery uses `brightness(0.82)` plus another dark overlay. | Accept: reference-based lighter image editing plus a targeted review of image filters. Preserve readable text where images sit behind copy. |
| P2 | Phone quick view crops product photography | `.quick-view > img` uses `object-fit: cover`; the multi-option phone layout caps the image at 190px. The natural lamp's base was visibly cut at the bottom. | Accept: contain the whole product in the bounded preview, while preserving room for the option controls and purchase button. |
| P2 | Automated coverage does not exercise image switching | Existing storefront tests cover page loading, price visibility and basket behaviour, but no option-image or thumbnail selection assertion exists. | Accept: add behavioural regression checks using deliberately distinct option photos, including equal-price options. |
| P3 | Homepage counts options as products | Live homepage says 73 products; live shop says 33. Source uses the flattened catalogue count on the homepage. | Accept as a small adjacent correction: use the product-group count or label the number as options. Not causal to the preview failure. |

## What was reproduced

| Surface | Selection | Result |
|---|---|---|
| Natural lamp detail, desktop | X-Small → Large | Price changed £11.99 → £39.99; product address and alternative text changed; image stayed `/media/live-site-products/wix-e11b5bf5-f5f.jpg`. |
| Natural lamp quick view, desktop | X-Small → Large | Selected control, £39.99 price and full-details link changed; same photo remained. |
| Natural lamp quick view, phone | Large → Medium | Price changed to £29.99 and link targeted Medium; same photo remained. |
| Platter detail, desktop | Direct visit to Round | Round selected and £19.99 shown; photograph depicted the square platter. |
| Platter gallery | Click support thumbnail | No main-photo change. Source confirms no interaction is implemented. |

The detail-page selection handler is working: it replaces the address and updates route state. This is not evidence of a React redraw failure or stale image cache. The data supplies the same source for every option. The popup has an additional binding defect that would remain after option-specific images were introduced.

The August 2 product-grouping change added option selection for pricing, stock, basket and links while retaining shared product photos. Its history and comments explicitly describe this design; there is no evidence that a previously implemented per-size photo feature recently stopped working.

## Affected catalogue

Current public catalogue: **33 products, 73 purchasable-option records; 13 multi-option products contain 53 option records**. Counts include out-of-stock options, some of which are omitted by the picker unless reached directly.

| Product family | Options |
|---|---:|
| Sphere lamp | 2 |
| Fire bowl lamp | 2 |
| Culinary salt | 6 |
| Serving bowls | 4 |
| Salt bricks | 2 |
| Square candle holders | 2 |
| Natural candle holders | 2 |
| Equestrian and cattle salt licks | 12 |
| Massage stones and sticks | 4 |
| Platters | 5 |
| Soap and scrub bars | 2 |
| Natural lamp | 4 |
| Bulbs | 6 |
| **Total** | **53** |

The 53 options do not necessarily require 53 unrelated photo shoots. Images can be reused when products look identical; packaging quantities, shapes and size comparisons should still be communicated accurately. For differently sized natural lamps, a consistent camera distance and a known scale reference are needed: tightly cropping each lamp to fill the same frame would hide the difference again. Physical dimensions must come from product evidence, not be inferred from price or option order.

## What “all pictures” currently covers

| Inventory group | Distinct references | Treatment |
|---|---:|---|
| Main catalogue product photos | 33 | All currently use Wix-named local files. Edit from those references and preserve actual geometry, bases, packaging and branding. |
| Additional uploaded product-gallery photos | 4 | Stored remotely, outside the local media directory. Include in the refresh and keep originals recoverable. |
| Other non-poster photographic references | 28 | Category, lifestyle, collection, theme and trade imagery. Include in the lighter direction where relevant. |
| Video poster images | 7 | Review visual continuity with the existing video. Changing a poster does not recolour the video. |
| Social sharing brand card | 1 | Review separately; no reason to recolour the logo automatically. |
| **Total candidate references** | **73** | **69 local static paths and four uploaded paths.** |

The local media directory has **134 raster image files**. This does not mean 134 images need regeneration: it includes alternate and legacy material. Conversely, a local-only batch misses all four uploaded gallery images. The inventory is saved with reference locations in `outputs/asim-image-audit-2026-09-07/image-inventory.json`.

All 69 static references returned successful image responses to HEAD requests. All four uploaded references returned real image data to GET, with valid JPEG/PNG signatures. Their HEAD responses returned the application's HTML fallback because that route only implements GET; this is a monitoring quirk, not proof that browser images are broken. One uploaded fire-basket PNG is about 2.08 MB and warrants compression when replaced.

The existing `scripts/optimise-media.mjs` resizes and compresses local JPEG/PNG files. It is not a colour-regeneration pipeline, does not process the remote gallery, and tracks output by size. The repository has generated still assets but no discovered repeatable still-image generation script with per-image reference/prompt/approval provenance. The present generators cover branding and videos.

## Recommended implementation design

Use the existing product gallery as the image store and introduce a small association between an option and its main gallery image. A separate mapping table keyed by the numeric option identity avoids duplicating image paths and can support an idempotent migration. Validate that the option and image belong to the same product; never key this by the display SKU code, because the schema documents reused codes.

Resolve the selected image once in the shared catalogue transformation, with the existing product primary as fallback. Keep the existing per-option routes and identifiers. The details page, quick view, product-group lead image, cart and generated product metadata should consume that resolved value. Checkout currently submits option identity and re-reads price/availability on the server; it does not send product photos to Stripe, so payment behaviour needs no image-driven redesign.

Admin needs a photo selector alongside each option, using the existing gallery. A gallery replacement should continue to resolve through its stable image identity. Deleting an assigned image must clear the association and fall back safely. Catalogue reset/import must either preserve associations by stable identities or explicitly remap them; it must not leave dangling assignments. Export/backup should include the new mapping.

A thumbnail selection should be subordinate to the selected option. Changing the option returns the preview to that option's image. Choosing an unrelated lifestyle thumbnail must not change price or the item added to the basket. If the image cannot load, show a clear fallback rather than silently displaying a different option.

This follows React's guidance to derive values from existing selection rather than duplicate state: [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure), checked 7 September 2026. Preserve option-specific addresses and matching product metadata as described in [Google's product-variant guidance](https://developers.google.com/search/docs/appearance/structured-data/product-variants), checked 7 September 2026.

## Lighter-image direction

Recommended direction: soft daylight, cream or off-white backgrounds, natural pale pink/peach salt, readable mineral texture, restrained warm illumination, and gentler shadows. Retain truthful product colour variation and the warm appearance of a lamp when lit. Do not turn every salt object uniformly white or remove identifying packaging and marks.

Create representative reference-based edits for a natural lamp, shaped lamp, kitchen product and Saltwood interior first. Review those in the actual card, product detail and popup sizes before processing the remaining inventory. This is a proposed production method, not completed regeneration or approved samples.

Record source, intended product/option, prompt, output, review status and replacement mapping. Keep original media and database mappings recoverable before a batch replacement: the existing admin Replace endpoint deletes the previous uploaded object after switching references. New uploaded objects already receive unique names and a long immutable cache, so new content should receive new identities rather than be overwritten behind the same cached address.

Update live content/category/product mappings and the committed snapshot together, then rebuild generated search/social pages. Editing only seed modules is insufficient because the running application fetches live content. Preserve the current Saltwood Frames wording and the existing unrelated work.

## Verification required for the implementation

| Check | Required result |
|---|---|
| Each multi-option family, desktop and phone | Correct selected state, image, price, stock and link; visibly accurate shape/size/pack representation. |
| Equal-price options | Image still changes when the option changes. |
| Gallery | Mouse and keyboard selection update the preview; option changes reset it appropriately. |
| Missing/unassigned/deleted/replaced image | Safe documented fallback; no cross-product image associations or dangling references. |
| Quick view → details → basket | Same selected option throughout; correct basket identity after reload. |
| Admin edit and import | Assignments persist and survive supported catalogue workflows. |
| Search and social metadata | Image corresponds to the product/option and all referenced assets resolve. |
| Lighter imagery | Visually checked in context; no product clipping, lost salt texture, misleading geometry or over-darkened page treatment. |
| Deployment | Full build and appropriate regression suite; verify test deployment before production changes. |

## Checks completed and limits

- Existing unit suite: **31 passed, zero failed**.
- Current frontend production compilation: **passed**, written to an isolated temporary output directory. This did not refresh the content snapshot, run search-page generation or deploy.
- Manual browser reproductions and screenshot inspections described above: completed.
- Public image availability: checked as described above; no confirmed missing image among the inventory.
- Admin capability and image lifecycle were reviewed in source; no remote admin edits, uploads, orders, emails or payments were performed.
- No application code, original image, live database or deployment changed. New work consists of this report and supporting inventory evidence.
- This is an in-depth investigation of the two reported issues and their dependencies, not a completed security audit, production certification or completed image refresh.

## Decision

Both reports are actionable. The preview issue requires option-image data, popup binding and gallery behaviour to be addressed together. The lighter-image request requires an inventory-led, reference-based refresh that covers both original catalogue photos and merchandising imagery, plus the display effects that influence their final appearance. Regenerating only files named “gemini” would not fix the catalogue or option previews.


## Implementation follow-up

The findings above are the pre-fix baseline. See [implementation and verification](asim-fixes-2026-09-07.md) for the completed local repair, media inventory, tests and deployment sequence. Production has not been changed.
