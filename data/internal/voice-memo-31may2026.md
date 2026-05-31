# Voice Memo — Asif, 31 May 2026 (09:50)

Source: WhatsApp Audio 2026-05-31 at 09.50.52  
Transcribed: Auto (Urdu/English mix — some garbling expected)  
Duration: 2 min 38 sec

---

## Extracted Requirements

### 1. Promotional / Bundle Pricing

Asif specifically requested the following offer mechanics on the site:

| Offer type | Example given | Location |
|---|---|---|
| Buy one, get second half price | "Buy one gets second half price" | Product pages |
| Multi-buy free item | "Buy three candle holders get one free" | Product pages / shop |
| Multi-buy free item | "Buy two and get one free" | Product pages / shop |

**Implication:** The commerce engine must support automatic discount rules or bundle pricing. This is not a simple coupon code — it requires rule-based cart logic (e.g. Shopify automatic discounts, WooCommerce dynamic pricing, or a custom cart hook). Must be surfaced visibly on product cards and product detail pages as badge callouts.

**Design requirement:** Special offer badges (e.g. "3 for 2", "Buy 1 Get 1 Half Price") must appear on product cards in the grid AND on product detail pages. A dedicated "Offers" collection or filter should be considered.

---

### 2. Responsive Design — Specific Bugs on Current Site

Asif described the following concrete failures on the current site:

| Bug | Description |
|---|---|
| Column shift on navigation | Left/right columns rearrange when the user navigates between pages — inconsistent layout |
| Mobile icon inconsistency | The hamburger / mobile navigation icon changes appearance or position between pages |
| Full cascade to single column | On mobile/tablet, all content stacks into a single column which may not always be the right behaviour for all content types |

**Implication for new build:** These are exactly the class of bugs that arise from Wix/template-based systems with no coherent layout system. The new React + Tailwind build resolves all of these by design — a single consistent layout component wraps every page with a locked header, fixed nav behaviour, and a defined responsive grid system. These bugs should be called out explicitly in the proposal's audit section as known issues being solved.

---

### 3. Confirmed Requirement: Full Responsiveness

Asif explicitly confirmed he needs the site to work on:
- Mobile phones
- Tablets
- Desktop computers

He described the difference in layout between desktop and mobile as a feature (different view on different screen sizes), not a bug — confirming that a responsive adaptive layout (not a single fixed layout) is the right approach.

---

### 4. Platform Reference (create.net)

Asif mentioned "create.net" in the context of describing the current site's layout issues. Per his instruction, this is to be ignored — the new site will be built on the new stack from scratch. No migration from any existing platform is required.

---

## Action Items from this Memo

1. Add promotional pricing to the tech stack requirements (commerce engine must support automatic discount rules)
2. Add bundle offer badges to product card and product detail page specifications
3. Add "Offers / Deals" as a shop filter and potential collection page
4. Document the column-shift and icon-inconsistency bugs in the audit as known resolved issues in the new build
5. Confirm with Asif: should there be a dedicated "Special Offers" page or just offer badges on individual product pages?
