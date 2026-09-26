# End-user review: page position and controls

Date: 2026-09-19

Target: `https://salty-lamps-proposal.pages.dev`

## Complaint transcript

> There are many pages like this. When I go to shop and I click on a product, the product page opens. But when it opens, it goes to the last line of the page instead of it starts from the top and it starts from the bottom. It opens up at the bottom of the page. And then I have to scroll it back up. Some pages start from the top and some pages start from the bottom. This also needs to be sorted.

## Reproduced finding

Opening a product from low down on the shop page initially showed the new product page at the old scroll position. On the phone layout it could remain thousands of pixels down before the global smooth-scroll animation eventually reached the top.

The shop link handler requested a smooth scroll before React had replaced the old page. The admin navigation used the same pre-render timing. Browser scroll restoration could also reinstate an old position on Back or Forward.

## Repair

- All storefront and admin route changes now reset the document to the top after the new route has rendered and before it paints.
- The reset is immediate, so the new page is never briefly shown at the old position.
- Browser Back and Forward use the same rule.
- Deliberate same-page links, such as the Trade section on Home, still land on their named section.
- Regression coverage exercises every listed storefront and admin route on desktop and phone, plus the exact product-card journey and browser history.

## Wider control review

The deployed proposal site was exercised across desktop and phone. Coverage included shop and product navigation, quick view, basket open/close/edit/remove, checkout recovery, mobile menu and filters, support forms, category Edit, admin page navigation, reports and exports, email templates and activity data, settings validation, documentation copy actions, test-suite controls, accessibility, and error recovery.

No additional reproducible button failure remained after the repair. The existing category Edit visibility repair also passed on desktop and phone.

## Product gallery and catalogue freshness

- Every product photo is now visible beside the main product image on wider screens and in a thumbnail rail on phones.
- Clicking the main photo opens an accessible full-size viewer with previous, next, close, Escape, and arrow-key controls.
- New, replaced, and deleted admin photos trigger an immediate shop catalogue refresh in the same tab and any already-open shop tab.
- The public catalogue response is no longer cached, so the next read cannot replay the previous gallery for up to a minute.
- Product structured data and the image sitemap now include every available product photo.

## Search visibility

- All 104 indexable page shells have unique titles and descriptions, canonical links, social sharing metadata, and valid structured data.
- Product options identify their shared product family without inventing ratings, delivery claims, or return terms.
- Sitemap dates that changed on every build were removed; search engines now receive only accurate data.
- Duplicate proposal and admin hosts remain blocked from indexing so they do not compete with the eventual customer domain.

## Remaining address task

- Paid UK shipping addresses are already saved in the orders database after Stripe confirms payment.
- Add postcode-led full-address suggestions at checkout using Stripe Address Element with Payment Element, or a licensed UK address provider.
- This requires a Stripe publishable key or licensed address-lookup key. Neither credential is currently available in the project, so the existing hosted Stripe checkout remains in place until the new flow can be tested without risking payments.

## Verification

- Production build completed and generated all route shells.
- 76 logic tests passed.
- 244 local end-to-end checks passed; 22 environment-specific checks were skipped.
- 161 deployed shop, admin, accessibility, gallery, and search checks passed; one device-specific check was skipped. The two initial failures correctly exposed that the duplicate proposal host is intentionally blocked from indexing; the corrected safeguard then passed on desktop and phone.
- A separate deployed search run passed all 14 checks, including every sitemap URL and every indexable page's metadata.
- Live visual inspection confirmed all three Saltwood Frames photos, enlargement, and next-photo navigation.
- Deployed build: `https://f4fac5f6.salty-lamps-proposal.pages.dev`

## Boundaries

This review did not make a real payment, send a real email, or confirm destructive deletion of owner data. Those actions remain intentionally outside automated UAT. Delete confirmation and cancellation paths were exercised without removing live owner records.
