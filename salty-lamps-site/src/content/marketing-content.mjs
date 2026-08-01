// The marketing content layer, lifted verbatim out of src/App.jsx.
//
// WHY THIS FILE EXISTS AT ALL — AND WHY IT IS TEMPORARY
//
// This is a staging post, not a destination. Everything here is about to live in D1
// (migration 004) and be served by GET /api/content. It exists for exactly one
// reason: scripts/extract-content-seed.mjs has to IMPORT this content to generate
// that migration, and it cannot import src/App.jsx because that file contains JSX.
//
// Moving the consts here first means the migration is generated mechanically from
// the real values rather than retyped, so the database provably starts out holding
// what the site renders today. Once the extraction is verified this module is read
// only by the extractor.
//
// The section `match` predicates are the important part. They are the ORIGINAL
// JavaScript, kept so the extractor can prove — product by product, section by
// section — that the JSON rules it writes into the database select exactly the same
// products. See extract-content-seed.mjs.
//
// MUST stay pure data + pure functions: no JSX, no React, no DOM, no Worker APIs.

import { img, media } from './site-content.mjs'

export const siteTitle = 'Salty Lamps | Himalayan Salt Lamps, Gifts, Saltware and Trade Supply'
export const siteDescription =
  'Shop Himalayan salt lamps, candle holders, kitchen saltware, salt bricks, salt licks, and trade stock from Salty Lamps Ltd in Stoke-on-Trent.'

export const pageCopy = {
  shop: {
    eyebrow: 'Shop Salty Lamps',
    title: 'Shop Himalayan salt lamps, candle holders, saltware, and salt licks.',
    description: 'Browse the full Salty Lamps range, or use the buyer paths and filters to narrow the choice quickly.',
  },
  notFound: {
    eyebrow: 'Page not found',
    title: 'This page is not available.',
    description: 'The product or page may have moved. Start with the full shop or choose a buyer path from the home page.',
  },
}

export const reassuranceByTheme = {
  lamp: ['Includes the lamp parts listed on the product card where applicable.', 'Natural rock salt varies in colour, texture, and weight.', 'Keep dry and use with compatible bulbs and cables.'],
  holder: ['Made from natural Himalayan rock salt, so every holder is slightly different.', 'Designed for tealight-style ambience and giftable table settings.', 'Keep dry and wipe clean with a soft cloth.'],
  kitchen: ['Food and serving items should be rinsed or wiped according to the supplied care guidance.', 'Saltware naturally changes with use, moisture, and heat.', 'Choose a size or grade before adding when selectors are shown.'],
  bricks: ['Suitable for project enquiries, salt wall features, and repeat trade supply.', 'Confirm size, quantity, and lead time before large orders.', 'Trade buyers can ask for project quoting before checkout.'],
  equestrian: ['Choose size and pack quantity before adding when selectors are shown.', 'Suitable for horses, cattle, fields, yards, and smallholding routines.', 'Bulk enquiries are available for repeat yard supply.'],
  relaxation: ['Made for sensory, spa, bath, or body-care use depending on the selected item.', 'Natural salt products vary in texture and finish.', 'Keep products dry between uses and follow supplied care guidance.'],
  accessory: ['Check compatibility with your lamp before ordering.', 'Bulbs and cables are practical replacement parts for existing lamps.', 'Ask the team if you are unsure which fitting you need.'],
  deal: ['Bundle offers make gift buying simpler.', 'Check included items before ordering.', 'Natural salt pieces vary, so each bundle has its own tone and texture.'],
}

export const featuredReviews = [
  {
    name: 'Carmela Ranieri',
    date: 'Wed 14th May 2014',
    quote:
      'I am very impressed with the quality of these items. As an interior designer, I would say that they would complement any scheme.',
    proof: 'Interior-quality products',
  },
  {
    name: 'Keri',
    date: 'Thu 20th Oct 2016',
    quote:
      'Very quick delivery and extremely well packaged. The lamp and candle holder are absolutely beautiful and very calming.',
    proof: 'Fast delivery and packaging',
  },
  {
    name: 'Stephanie Wilson',
    date: 'Thu 9th Mar 2017',
    quote:
      "Absolutely beautiful and everything I was hoping it would be. Superb quality and super fast delivery.",
    proof: 'Product quality',
  },
  {
    name: 'Jennie',
    date: 'Wed 22nd Dec 2010',
    quote:
      'Simple to order, excellent communications, quick responses, and a lovely glow to any room.',
    proof: 'Customer service',
  },
  {
    name: 'C Jones',
    date: 'Wed 5th Dec 2012',
    quote:
      'Brilliant service. Goods delivered today, packed well, and left exactly where instructed.',
    proof: 'Careful fulfilment',
  },
]

// Which featured review is shown as proof on each theme's product pages, by index
// into featuredReviews. Stored as an index rather than a copy so the extractor can
// turn it into a real foreign key (content_themes.proof_review_id).
export const proofReviewIndexByTheme = {
  lamp: 1, holder: 0, kitchen: 2, bricks: 0, equestrian: 4,
  relaxation: 3, accessory: 4, deal: 1, panel: 0,
}

// Display-only filter for republished guestbook notes: quotes making medical or
// air-treatment claims stay in the archive but are never rendered, since a
// republished testimonial counts as a marketing claim under UK ASA guidance.
//
// This moves to WRITE time in the database as reviews.display + flagged_reason, so
// suppressing or restoring a quote becomes a deliberate, audited act rather than a
// regex re-run on every render.
export const medicalClaimPattern =
  /asthma|eczema|pneumonia|\blungs?\b|purif|air quality|negative ions?|healing|\bheals?\b|detox|\bcures?\b/i

export const supportImages = {
  lamp: [
    { src: img('lamp-sphere-gemini.jpg'), alt: 'Glowing Himalayan salt lamp' },
    { src: img('lamp-block-gemini.jpg'), alt: 'Block Himalayan salt lamp' },
    { src: img('lamp-tear-drop-gemini.jpg'), alt: 'Tear drop Himalayan salt lamp' },
  ],
  holder: [
    { src: img('holder-natural-gemini.jpg'), alt: 'Natural Himalayan salt candle holder' },
    { src: img('holder-sphere-gemini.jpg'), alt: 'Sphere Himalayan salt candle holder' },
  ],
  kitchen: [
    { src: img('salty-chef-family-live-site.png'), alt: 'Salty Chef Himalayan salt range' },
    { src: img('platter-kitchen-gemini.jpg'), alt: 'Himalayan salt platter in a kitchen setting' },
  ],
  bricks: [
    { src: img('salt-bricks-clean-gemini.jpg'), alt: 'Himalayan salt bricks' },
    { src: img('salt-wall-installation-live-site.png'), alt: 'Backlit Himalayan salt wall installation' },
  ],
  equestrian: [
    { src: img('lick-product-clean-gemini.jpg'), alt: 'Himalayan rock salt lick product' },
    { src: img('lick-field-scene-gemini.jpg'), alt: 'Himalayan salt licks for horses and cattle' },
  ],
  relaxation: [
    { src: img('massage-stones-gemini.jpg'), alt: 'Himalayan salt massage stones' },
    { src: img('soap-scrub-bars-gemini.jpg'), alt: 'Himalayan salt soap and scrub bars' },
  ],
  accessory: [
    { src: img('accessory-bulb-gemini.jpg'), alt: 'Salt lamp replacement bulb' },
    { src: img('accessory-cable-premium-gemini.jpg'), alt: 'Salt lamp replacement cable' },
  ],
  deal: [
    { src: img('holder-apple-gemini.jpg'), alt: 'Giftable Himalayan salt candle holder' },
    { src: img('lamp-sphere-gemini.jpg'), alt: 'Himalayan salt lamp gift set' },
  ],
  panel: [
    { src: img('aura-collection-livingroom-live-site.jpg'), alt: 'Framed Himalayan salt wall panels in a living room' },
    { src: img('aura-collection-hotel-lobby-live-site.jpg'), alt: 'Framed Himalayan salt wall panels in a hotel lobby' },
  ],
}

// `lede` is stored as a template containing {name}, interpolated at read time — one
// theme row serves every product in that theme.
export const sellingContentByTheme = {
  lamp: {
    lede: '{name} brings a warm amber glow to bedrooms, lounges, desks, treatment rooms, and gift shelves. Each piece is cut from natural Himalayan rock salt, so the colour, shape, and surface character feel individual rather than factory-perfect.',
    useTitle: 'Where it works best',
    uses: ['Bedside tables, shelves, desks, lounges, and calm corners.', 'Gift buying when the recipient likes warm, natural decor.', 'Spa, wellness, or reception areas that need softer ambient light.'],
    careTitle: 'Care and setup',
    care: ['Keep the salt dry and away from damp rooms or wet surfaces.', 'Use compatible lamp parts and check bulbs or cables before replacing.', 'Expect natural variation in tone, texture, and weight.'],
    promise: 'A simple way to add warmth, texture, and atmosphere without making the room feel overly decorated.',
  },
  holder: {
    lede: '{name} is made for small moments of glow: dining tables, bedside shelves, spa rooms, gifting, and relaxed evening settings. The natural salt surface gives every holder its own tone and mineral texture.',
    useTitle: 'Best used for',
    uses: ['Tealight ambience for dining tables, shelves, bedrooms, and spa spaces.', 'Low-risk gifting when you want something natural and decorative.', 'Grouped displays with lamps, bowls, or other saltware.'],
    careTitle: 'Care and safety',
    care: ['Keep dry and wipe with a soft cloth when needed.', 'Use suitable tealights and place on a stable, heat-safe surface.', 'Colour and surface markings vary because the holder is natural rock salt.'],
    promise: 'Small, giftable pieces that create an immediate warm glow without needing a large lamp.',
  },
  kitchen: {
    lede: '{name} is designed for kitchens, serving, food display, and thoughtful hosting. It gives food presentation a natural pink salt character while still feeling practical for counters, tables, and giftable kitchen ranges.',
    useTitle: 'How to use it',
    uses: ['Serve, present, chill, or display food depending on the selected shape and size.', 'Use for kitchen counters, table settings, food gifting, or hospitality presentation.', 'Pair with culinary salt, bowls, or serving pieces for a fuller saltware set.'],
    careTitle: 'Care before buying',
    care: ['Rinse or wipe according to the supplied care guidance and dry thoroughly.', 'Saltware naturally changes with heat, moisture, food contact, and repeated use.', 'Choose the size, grade, or shape that matches how you plan to serve or cook.'],
    promise: 'A more memorable kitchen piece for buyers who want food presentation to feel tactile, natural, and conversation-worthy.',
  },
  bricks: {
    lede: '{name} is suited to salt wall features, wellness rooms, spa projects, interiors work, and repeat trade supply. It is a practical route for buyers who need natural salt material with a project or display purpose.',
    useTitle: 'Project fit',
    uses: ['Salt wall features, wellness rooms, spa areas, and interior displays.', 'Retail, trade, or hospitality buyers planning repeat supply.', 'Specification conversations where size, quantity, and finish matter.'],
    careTitle: 'Planning notes',
    care: ['Confirm sizes, quantities, and lead times before large orders.', 'Keep salt materials dry before installation or display.', 'Ask for trade support when matching a project schedule or repeat stock need.'],
    promise: 'Built for buyers who need confidence before committing to a larger project or repeat order.',
  },
  equestrian: {
    lede: '{name} gives horses, cattle, fields, yards, and smallholdings a simple natural salt option. It is made for practical repeat buying rather than decorative display.',
    useTitle: 'Yard and field use',
    uses: ['Fields, stables, yards, smallholdings, and animal mineral routines.', 'Single purchases or repeat supply for busier yards.', 'Buyers who want a simple natural salt lick without complicated presentation.'],
    careTitle: 'Buying notes',
    care: ['Choose the correct size or pack quantity where options are shown.', 'Store dry before use and place appropriately for the animal and setting.', 'Ask about bulk supply if you are buying for a yard, field, or repeat routine.'],
    promise: 'A straightforward mineral-salt product for buyers who care more about reliability than decoration.',
  },
  relaxation: {
    lede: '{name} supports spa, bath, massage, body-care, and sensory routines with the natural mineral character of Himalayan salt. It works well for personal use, wellness gifts, and treatment-room ranges.',
    useTitle: 'Wellness use',
    uses: ['Spa, bath, massage, relaxation, or body-care routines depending on the item.', 'Gift bundles for buyers who want calm, tactile, natural products.', 'Treatment rooms or wellness retail displays.'],
    careTitle: 'Care guidance',
    care: ['Keep dry between uses and follow the supplied care notes.', 'Texture, colour, and finish vary naturally from piece to piece.', 'Choose the format that matches the intended routine or treatment.'],
    promise: 'A tactile wellness product with enough natural variation to feel personal and giftable.',
  },
  accessory: {
    lede: '{name} helps keep compatible salt lamps working safely and conveniently. It is a practical replacement item for buyers who already own a lamp or need spare parts for repeat use.',
    useTitle: 'Compatibility first',
    uses: ['Replacement parts for compatible salt lamps.', 'Keeping spare bulbs or cables ready for home, retail, or trade use.', 'Solving a practical lamp issue without replacing the full product.'],
    careTitle: 'Before ordering',
    care: ['Check compatibility with your lamp before buying.', 'Match bulb, cable, plug, and holder requirements carefully.', 'Ask the team if you are unsure which fitting you need.'],
    promise: 'A practical support item that protects the value of the lamp you already own.',
  },
  deal: {
    lede: '{name} is made for easy gifting, starter sets, and better-value bundles. It helps buyers choose quickly when they want a warm salt product without comparing every individual item.',
    useTitle: 'Why choose the bundle',
    uses: ['Quick gift buying when you want a ready-made salt product set.', 'Starter purchases for homes, desks, lounges, and shelves.', 'Better value when buying more than one piece.'],
    careTitle: 'What to expect',
    care: ['Check the included items before ordering.', 'Natural salt pieces vary in colour, texture, and weight.', 'Keep items dry and follow the care notes for the product type included.'],
    promise: 'A simpler route for buyers who want the Salty Lamps look with less decision fatigue.',
  },
  panel: {
    lede: '{name} is illuminated Himalayan salt wall art — ancient rock salt carved into a hand-finished solid-wood frame. Each panel is a unique piece of nature, with mineral veining that ranges from pale pink to deep orange, and a warm glow that changes the feel of a room the moment it is lit.',
    useTitle: 'Where it works best',
    uses: ['Living rooms, bedrooms, and home offices that want a warmer, calmer feel.', 'Gyms, yoga studios, and wellness spaces where a soft glow sets the tone.', 'Reception areas and interiors projects that want a natural statement piece.'],
    careTitle: 'Setup and care',
    care: ['Keep the panel dry and wipe gently with a dry cloth.', 'Avoid prolonged exposure to humidity — mount securely with the supplied fittings.', 'Natural variation in colour, veining, and texture is normal; no two panels are alike.'],
    promise: 'A unique piece of nature, framed by hand, bringing warmth and timeless character to any wall.',
  },
}

// The review-strength bars on the home page and /reviews.
//
// These numbers are NOT invented — all five reconcile exactly against the 195-row
// corpus (122/195 → 63%, 96/195 → 49%, 88/195 → 45%, 62/195 → 32%, 24/195 → 12%).
// They are a computed-then-frozen snapshot, which means they drift silently the
// moment the corpus changes.
//
// Moving them into the database does not fix the drift, it makes it EDITABLE and
// visible instead of buried in a source file. The real fix is to compute them from
// per-review themes, which needs the corpus themed first — see the note in the
// session summary.
export const reviewSignals = [
  { label: 'Product quality', count: 122, percent: 63 },
  { label: 'Delivery speed', count: 96, percent: 49 },
  { label: 'Helpful service', count: 88, percent: 45 },
  { label: 'Repeat buyers', count: 62, percent: 32 },
  { label: 'Careful packaging', count: 24, percent: 12 },
]

// The ordered card lists across the site. They share one shape — label/title/text —
// so one table and one admin editor serve all of them.
export const listItems = {
  'process-steps': [
    { label: 'Mine', title: 'Mined rock salt', text: 'Raw rock salt is extracted from mines and loaded onto trucks for the first leg of the journey.' },
    { label: 'Sort', title: 'Warehouse sorting', text: 'The material reaches the Karachi warehouse, where it is washed, dried, and separated by colour and quality.' },
    { label: 'Cut', title: 'Cut and shaped', text: 'Rock salt is cut into natural lamps, specific shapes, bowls, bricks, tiles, and other product forms.' },
    { label: 'Finish', title: 'Hand finished', text: 'Each cut piece is carefully hand-crafted by skilled workmen so the natural material keeps its character.' },
    { label: 'Pack', title: 'Packed for export', text: 'Finished pieces are shrink wrapped, boxed, palletized, and sent to the port for export.' },
  ],
  'process-proof-points': [
    { label: 'Handled', title: 'Real labour at every stage', text: 'The film shows the physical movement behind the product: lifting, rinsing, sorting, cutting, finishing, and packing.' },
    { label: 'Checked', title: 'Natural material, judged piece by piece', text: 'Colour, clarity, size, grain, and fractures all affect what each piece can become.' },
    { label: 'Finished', title: 'Machine cut, human refined', text: 'The work keeps the irregular mineral character while making each item ready for use or display.' },
    { label: 'Arrived', title: 'From workshop to home', text: 'The close is not another step list: it brings the journey home as a finished object with warmth and presence.' },
  ],
  // Deliberately editorial rather than derived from `categories`: this list is finer
  // grained than the taxonomy (it splits kitchen into bowls, culinary salt and
  // platters). `href` points at a real category route so the copy cannot drift into
  // linking nowhere.
  'process-product-ranges': [
    { label: '', title: 'Rock salt lamps', text: 'Warm amber lighting for bedrooms, lounges, desks, treatment rooms, and gift shelves.', href: '/category/salt-lamps' },
    { label: '', title: 'Candle holders', text: 'Natural tealight pieces for tables, baths, shelves, spa corners, and calming evening settings.', href: '/category/candle-holders' },
    { label: '', title: 'Bowls and kitchen saltware', text: 'Serving, cooking, and presentation pieces that bring mineral texture into everyday food moments.', href: '/category/rock-salt-pantry-items' },
    { label: '', title: 'Culinary and bath salts', text: 'Pure Himalayan salt formats for cooking, bathing, gifting, and simple personal-care routines.', href: '/category/rock-salt-pantry-items' },
    { label: '', title: 'Cooking platters', text: 'Salt slabs for grilling, chilling, serving, and adding a gentle natural salt character to food.', href: '/category/rock-salt-pantry-items' },
    { label: '', title: 'Bricks and curing tiles', text: 'Trade-ready salt blocks for butchers, dry-ageing, display, interiors, and specialist supply.', href: '/category/rock-salt-bricks' },
    { label: '', title: 'Spa salt walls', text: 'Custom salt wall installations for spas, wellness rooms, yoga studios, and treatment spaces.', href: '/category/rock-salt-bricks' },
    { label: '', title: 'Horse and cattle licks', text: 'Natural mineral salt blocks and loose forms for yards, fields, livestock, and repeat rural supply.', href: '/category/equestrian-salt-licks' },
  ],
}

export const collectionTradeCopy = {
  'home-gifts': {
    eyebrow: 'Shops, salons and interior buyers',
    heading: 'Trade accounts for retail and hospitality.',
    body: 'We supply boutique gift shops, hotel amenities buyers, and salon chains. Contact us for trade pricing, minimum orders, and lead times.',
    cta: 'Open a trade enquiry',
  },
  'kitchen-food': {
    eyebrow: 'Restaurants, caterers and chefs',
    heading: 'Case and pallet supply for professional kitchens.',
    body: 'Culinary-grade Himalayan salt, cooking platters, and serving pieces at trade pricing for restaurants, food service, and hospitality.',
    cta: 'Request catering trade pricing',
  },
  'horses-farm': {
    eyebrow: 'Yards, equestrian centres and farms',
    heading: 'Bulk salt lick supply for busy yards.',
    body: 'Trade pricing on pallet quantities for equestrian centres, livery yards, and farms with multiple horses, cattle, or sheep.',
    cta: 'Ask about bulk lick pricing',
  },
  'trade-spa': {
    eyebrow: 'Spas, wellness rooms and interiors',
    heading: 'Specification, project quoting, and repeat supply.',
    body: 'Salt wall bricks, massage stones, and bath salts for spa specification, wellness room fit-outs, and high-volume treatment centres.',
    cta: 'Request a project quote',
  },
}

// ---------------------------------------------------------------------------
// Section rules — the ORIGINAL predicates
//
// Each section also carries a `rule`, the declarative JSON form that goes into the
// database. The extractor asserts the two agree on every product before it will
// write the migration; if any product disagrees it aborts naming the product, the
// section, and both answers. That turns "we think these are equivalent" into a
// checked fact.

export const slugifyTag = value =>
  String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const hasTag = (product, tags) => {
  const want = new Set(tags.map(slugifyTag))
  return (product.tags || []).some(tag => want.has(slugifyTag(tag)))
}

export const collectionSectionConfig = {
  'home-gifts': [
    {
      id: 'gift-sets-offers',
      title: 'Gift sets & offers',
      descriptor: 'Starter bundles and easy gift buys with a clear value story.',
      cardText: 'Best for shoppers who want a complete present without comparing every shape.',
      recommendation: 'Lead with bundles because gift-led visitors usually need confidence and speed more than a deep catalogue.',
      image: img('deal-lamp-candle-gemini.jpg'),
      theme: 'deal',
      categorySlug: 'special-deal',
      match: product => product.categories.includes('special-deal'),
      rule: { categories: { any: ['special-deal'] } },
    },
    {
      id: 'salt-lamps',
      title: 'Salt lamps',
      descriptor: 'Warm-glow lamps for bedrooms, counters, lounges, and gifts.',
      cardText: 'Choose the main glow piece for a bedside table, desk, shelf, or cosy corner.',
      recommendation: 'Make natural and bestseller lamps the anchor, then let shaped lamps act as decorative alternatives.',
      image: img('lamp-natural-gemini.jpg'),
      theme: 'lamp',
      categorySlug: 'salt-lamps',
      match: product => product.categories.includes('salt-lamps') && !product.categories.includes('special-deal'),
      rule: { categories: { any: ['salt-lamps'], none: ['special-deal'] } },
      subgroups: [
        {
          label: 'Natural, classic & bestselling',
          match: product => hasTag(product, ['bestseller', 'classic', 'premium']),
          rule: { tags: { any: ['bestseller', 'classic', 'premium'] } },
        },
        { label: 'Decorative, sculptural & gift shapes', rule: {} },
      ],
    },
    {
      id: 'candle-holders',
      title: 'Candle holders',
      descriptor: 'Giftable tealight holders for cosy rooms, spas, and tables.',
      cardText: 'Small amber accents for dinner tables, shelves, gift boxes, and quiet evenings.',
      recommendation: 'Treat holders as affordable add-ons and small gifts, not as direct competitors to lamps.',
      image: img('holder-heart-gemini.jpg'),
      theme: 'holder',
      categorySlug: 'candle-holders',
      match: product => product.categories.includes('candle-holders') && !product.categories.includes('special-deal'),
      rule: { categories: { any: ['candle-holders'], none: ['special-deal'] } },
    },
    {
      id: 'accessories',
      title: 'Accessories',
      descriptor: 'Replacement bulbs and cables for compatible salt lamps.',
      cardText: 'Keep an existing lamp lit with the right cable or replacement bulb.',
      recommendation: 'Keep accessories at the end so they support owners without interrupting gift and decor browsing.',
      image: img('accessory-bulb-gemini.jpg'),
      theme: 'accessory',
      categorySlug: 'accessories',
      match: product => product.categories.includes('accessories'),
      rule: { categories: { any: ['accessories'] } },
    },
  ],
  'kitchen-food': [
    {
      id: 'cookware-serving',
      title: 'Cookware & serving',
      descriptor: 'Platters and bowls to cook, chill, and serve on pure salt.',
      cardText: 'Saltware for grazing boards, searing, chilling, and table presentation.',
      recommendation: 'Start with serving pieces because they are visual, giftable, and easier to understand at a glance.',
      image: img('platter-kitchen-gemini.jpg'),
      theme: 'kitchen',
      categorySlug: 'rock-salt-pantry-items',
      match: product => hasTag(product, ['hosting', 'serving']),
      rule: { tags: { any: ['hosting', 'serving'] } },
    },
    {
      id: 'pantry-barware',
      title: 'Pantry & barware',
      descriptor: 'Culinary salt and salt barware for everyday cooking and hosting.',
      cardText: 'Pink mineral salt and smaller pieces for seasoning, drinks, and easy hosting.',
      recommendation: 'Use pantry items as lower-friction add-ons after the shopper understands the food range.',
      image: img('salty-chef-pouch-gemini.jpg'),
      theme: 'kitchen',
      categorySlug: 'rock-salt-pantry-items',
      // Catch-all: with no tags set, everything kitchen lands here rather than in
      // the unnamed "More in this range" sweep, so the page reads correctly with or
      // without tag data.
      match: product => product.categories.includes('rock-salt-pantry-items'),
      rule: { categories: { any: ['rock-salt-pantry-items'] } },
    },
  ],
  'horses-farm': [
    {
      id: 'stable-field-licks',
      title: 'Stable & field licks',
      descriptor: 'Single mineral salt licks for horses, cattle, fields, and yards.',
      cardText: 'A simple natural lick for a paddock, stable, pony, or smallholding routine.',
      recommendation: 'Show the single lick first because it answers the basic buyer need before pack-size decisions.',
      image: img('lick-product-clean-gemini.jpg'),
      theme: 'equestrian',
      categorySlug: 'equestrian-salt-licks',
      match: product => product.categories.includes('equestrian-salt-licks') && !product.categories.includes('special-deal'),
      rule: { categories: { any: ['equestrian-salt-licks'], none: ['special-deal'] } },
    },
    {
      id: 'yard-bulk-supply',
      title: 'Yard & bulk supply',
      descriptor: 'Bulk-ready salt lick supply for busier yards and repeat orders.',
      cardText: 'A practical route for keepers who need dependable repeat stock.',
      recommendation: 'Separate bulk supply so trade and yard buyers see repeat-order value without confusing single-item shoppers.',
      image: img('lick-field-scene-gemini.jpg'),
      theme: 'equestrian',
      categorySlug: 'equestrian-salt-licks',
      match: product => product.categories.includes('equestrian-salt-licks') && product.categories.includes('special-deal'),
      // The `all` list exists for exactly this rule. Without it the condition would
      // have to lean on the collection's category pre-filter and would break the
      // moment collection membership was edited in admin.
      rule: { categories: { all: ['equestrian-salt-licks', 'special-deal'] } },
    },
  ],
  'trade-spa': [
    {
      id: 'salt-bricks-walls',
      title: 'Salt bricks & walls',
      descriptor: 'Salt wall bricks and feature-wall materials for trade buyers.',
      cardText: 'Create a glowing wall feature for reception areas, treatment rooms, and projects.',
      recommendation: 'Lead with project materials because trade buyers need specification clarity before browsing spa retail pieces.',
      image: img('salt-bricks-clean-gemini.jpg'),
      theme: 'bricks',
      categorySlug: 'rock-salt-bricks',
      match: product => product.categories.includes('rock-salt-bricks'),
      rule: { categories: { any: ['rock-salt-bricks'] } },
    },
    {
      id: 'spa-relaxation',
      title: 'Spa & relaxation',
      descriptor: 'Massage, bath, and body-care salt for wellness spaces.',
      cardText: 'Retail-friendly wellness pieces for treatment rooms, bath rituals, and shelves.',
      recommendation: 'Place relaxation products after salt walls so they feel like retail add-ons for wellness and spa buyers.',
      image: img('massage-stones-gemini.jpg'),
      theme: 'relaxation',
      categorySlug: 'himalayan-salt-massage-relaxation-products',
      match: product => product.categories.includes('himalayan-salt-massage-relaxation-products'),
      rule: { categories: { any: ['himalayan-salt-massage-relaxation-products'] } },
    },
  ],
}

// The trailing sweep that catches anything no section claimed. It has no rule
// because it is not a rule — it is "whatever is left", computed after assignment.
export const LEFTOVER_SECTION_TITLE = 'More in this range'
