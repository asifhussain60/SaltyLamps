import React, { useEffect, useMemo, useState } from 'react'
import reviews from './data/reviews.json'
import { hasSupabase, supabase } from './lib/supabase'
import AdminApp from './admin/AdminApp.jsx'
import {
  categories,
  categoryAliases,
  groupThemes,
  img,
  media,
  pages,
  shopperPaths,
  siteUrl,
} from './content/site-content.mjs'

const money = value =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value)

// Aura Collection pricing isn't finalised yet (see the size-ladder products
// below) — priceTBD swaps the real number out for "TBD" everywhere a price
// would otherwise display, and disables purchasing until it's confirmed.
const priceLabel = product => (product.priceTBD ? 'TBD' : money(product.price))



const publicCategorySlug = slug => resolveCategorySlug(slug)
const resolveCategorySlug = slug => categoryAliases[slug] || slug
const categoryHref = slug => `/category/${publicCategorySlug(slug)}`
const collectionCategoryHref = (collectionSlug, categorySlug) =>
  `/collection/${collectionSlug}/${publicCategorySlug(categorySlug)}`

const primaryCategory = product => product.categories.find(slug => slug !== 'all-products') || 'all-products'

const themeForProduct = product => groupThemes[primaryCategory(product)] || 'lamp'

const categoryName = slug => categories.find(category => category.slug === slug)?.name || 'All products'

const siteTitle = 'Salty Lamps | Himalayan Salt Lamps, Gifts, Saltware and Trade Supply'
const siteDescription =
  'Shop Himalayan salt lamps, candle holders, kitchen saltware, salt bricks, salt licks, and trade stock from Salty Lamps Ltd in Stoke-on-Trent.'

const pageTitle = title => (title ? `${title} | Salty Lamps` : siteTitle)

const pageCopy = {
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

const reassuranceByTheme = {
  lamp: ['Includes the lamp parts listed on the product card where applicable.', 'Natural rock salt varies in colour, texture, and weight.', 'Keep dry and use with compatible bulbs and cables.'],
  holder: ['Made from natural Himalayan rock salt, so every holder is slightly different.', 'Designed for tealight-style ambience and giftable table settings.', 'Keep dry and wipe clean with a soft cloth.'],
  kitchen: ['Food and serving items should be rinsed or wiped according to the supplied care guidance.', 'Saltware naturally changes with use, moisture, and heat.', 'Choose a size or grade before adding when selectors are shown.'],
  bricks: ['Suitable for project enquiries, salt wall features, and repeat trade supply.', 'Confirm size, quantity, and lead time before large orders.', 'Trade buyers can ask for project quoting before checkout.'],
  equestrian: ['Choose size and pack quantity before adding when selectors are shown.', 'Suitable for horses, cattle, fields, yards, and smallholding routines.', 'Bulk enquiries are available for repeat yard supply.'],
  relaxation: ['Made for sensory, spa, bath, or body-care use depending on the selected item.', 'Natural salt products vary in texture and finish.', 'Keep products dry between uses and follow supplied care guidance.'],
  accessory: ['Check compatibility with your lamp before ordering.', 'Bulbs and cables are practical replacement parts for existing lamps.', 'Ask the team if you are unsure which fitting you need.'],
  deal: ['Bundle offers make gift buying simpler.', 'Check included items before ordering.', 'Natural salt pieces vary, so each bundle has its own tone and texture.'],
}

const featuredReviews = [
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

// Display-only filter for republished guestbook notes: quotes making medical or
// air-treatment claims stay in the archive but are never rendered, since a
// republished testimonial counts as a marketing claim under UK ASA guidance.
const medicalClaimPattern = /asthma|eczema|pneumonia|\blungs?\b|purif|air quality|negative ions?|healing|\bheals?\b|detox|\bcures?\b/i
const displayableReviews = reviews.filter(review => !medicalClaimPattern.test(review.feedback || ''))

const proofByTheme = {
  lamp: featuredReviews[1],
  holder: featuredReviews[0],
  kitchen: featuredReviews[2],
  bricks: featuredReviews[0],
  equestrian: featuredReviews[4],
  relaxation: featuredReviews[3],
  accessory: featuredReviews[4],
  deal: featuredReviews[1],
  panel: featuredReviews[0],
}

const reviewSignals = [
  { label: 'Product quality', count: 122, percent: 63 },
  { label: 'Delivery speed', count: 96, percent: 49 },
  { label: 'Helpful service', count: 88, percent: 45 },
  { label: 'Repeat buyers', count: 62, percent: 32 },
  { label: 'Careful packaging', count: 24, percent: 12 },
]

const initialsFor = name =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

const supportImages = {
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

const supportImagesForProduct = product => {
  const productSupport = supportImages[themeForProduct(product)] || supportImages.lamp
  const seen = new Set([product.image])
  return [...productSupport, ...supportImages.lamp]
    .filter(item => {
      if (seen.has(item.src)) return false
      seen.add(item.src)
      return true
    })
    .slice(0, 2)
}

const sellingContentByTheme = {
  lamp: {
    lede: name => `${name} brings a warm amber glow to bedrooms, lounges, desks, treatment rooms, and gift shelves. Each piece is cut from natural Himalayan rock salt, so the colour, shape, and surface character feel individual rather than factory-perfect.`,
    useTitle: 'Where it works best',
    uses: ['Bedside tables, shelves, desks, lounges, and calm corners.', 'Gift buying when the recipient likes warm, natural decor.', 'Spa, wellness, or reception areas that need softer ambient light.'],
    careTitle: 'Care and setup',
    care: ['Keep the salt dry and away from damp rooms or wet surfaces.', 'Use compatible lamp parts and check bulbs or cables before replacing.', 'Expect natural variation in tone, texture, and weight.'],
    promise: 'A simple way to add warmth, texture, and atmosphere without making the room feel overly decorated.',
  },
  holder: {
    lede: name => `${name} is made for small moments of glow: dining tables, bedside shelves, spa rooms, gifting, and relaxed evening settings. The natural salt surface gives every holder its own tone and mineral texture.`,
    useTitle: 'Best used for',
    uses: ['Tealight ambience for dining tables, shelves, bedrooms, and spa spaces.', 'Low-risk gifting when you want something natural and decorative.', 'Grouped displays with lamps, bowls, or other saltware.'],
    careTitle: 'Care and safety',
    care: ['Keep dry and wipe with a soft cloth when needed.', 'Use suitable tealights and place on a stable, heat-safe surface.', 'Colour and surface markings vary because the holder is natural rock salt.'],
    promise: 'Small, giftable pieces that create an immediate warm glow without needing a large lamp.',
  },
  kitchen: {
    lede: name => `${name} is designed for kitchens, serving, food display, and thoughtful hosting. It gives food presentation a natural pink salt character while still feeling practical for counters, tables, and giftable kitchen ranges.`,
    useTitle: 'How to use it',
    uses: ['Serve, present, chill, or display food depending on the selected shape and size.', 'Use for kitchen counters, table settings, food gifting, or hospitality presentation.', 'Pair with culinary salt, bowls, or serving pieces for a fuller saltware set.'],
    careTitle: 'Care before buying',
    care: ['Rinse or wipe according to the supplied care guidance and dry thoroughly.', 'Saltware naturally changes with heat, moisture, food contact, and repeated use.', 'Choose the size, grade, or shape that matches how you plan to serve or cook.'],
    promise: 'A more memorable kitchen piece for buyers who want food presentation to feel tactile, natural, and conversation-worthy.',
  },
  bricks: {
    lede: name => `${name} is suited to salt wall features, wellness rooms, spa projects, interiors work, and repeat trade supply. It is a practical route for buyers who need natural salt material with a project or display purpose.`,
    useTitle: 'Project fit',
    uses: ['Salt wall features, wellness rooms, spa areas, and interior displays.', 'Retail, trade, or hospitality buyers planning repeat supply.', 'Specification conversations where size, quantity, and finish matter.'],
    careTitle: 'Planning notes',
    care: ['Confirm sizes, quantities, and lead times before large orders.', 'Keep salt materials dry before installation or display.', 'Ask for trade support when matching a project schedule or repeat stock need.'],
    promise: 'Built for buyers who need confidence before committing to a larger project or repeat order.',
  },
  equestrian: {
    lede: name => `${name} gives horses, cattle, fields, yards, and smallholdings a simple natural salt option. It is made for practical repeat buying rather than decorative display.`,
    useTitle: 'Yard and field use',
    uses: ['Fields, stables, yards, smallholdings, and animal mineral routines.', 'Single purchases or repeat supply for busier yards.', 'Buyers who want a simple natural salt lick without complicated presentation.'],
    careTitle: 'Buying notes',
    care: ['Choose the correct size or pack quantity where options are shown.', 'Store dry before use and place appropriately for the animal and setting.', 'Ask about bulk supply if you are buying for a yard, field, or repeat routine.'],
    promise: 'A straightforward mineral-salt product for buyers who care more about reliability than decoration.',
  },
  relaxation: {
    lede: name => `${name} supports spa, bath, massage, body-care, and sensory routines with the natural mineral character of Himalayan salt. It works well for personal use, wellness gifts, and treatment-room ranges.`,
    useTitle: 'Wellness use',
    uses: ['Spa, bath, massage, relaxation, or body-care routines depending on the item.', 'Gift bundles for buyers who want calm, tactile, natural products.', 'Treatment rooms or wellness retail displays.'],
    careTitle: 'Care guidance',
    care: ['Keep dry between uses and follow the supplied care notes.', 'Texture, colour, and finish vary naturally from piece to piece.', 'Choose the format that matches the intended routine or treatment.'],
    promise: 'A tactile wellness product with enough natural variation to feel personal and giftable.',
  },
  accessory: {
    lede: name => `${name} helps keep compatible salt lamps working safely and conveniently. It is a practical replacement item for buyers who already own a lamp or need spare parts for repeat use.`,
    useTitle: 'Compatibility first',
    uses: ['Replacement parts for compatible salt lamps.', 'Keeping spare bulbs or cables ready for home, retail, or trade use.', 'Solving a practical lamp issue without replacing the full product.'],
    careTitle: 'Before ordering',
    care: ['Check compatibility with your lamp before buying.', 'Match bulb, cable, plug, and holder requirements carefully.', 'Ask the team if you are unsure which fitting you need.'],
    promise: 'A practical support item that protects the value of the lamp you already own.',
  },
  deal: {
    lede: name => `${name} is made for easy gifting, starter sets, and better-value bundles. It helps buyers choose quickly when they want a warm salt product without comparing every individual item.`,
    useTitle: 'Why choose the bundle',
    uses: ['Quick gift buying when you want a ready-made salt product set.', 'Starter purchases for homes, desks, lounges, and shelves.', 'Better value when buying more than one piece.'],
    careTitle: 'What to expect',
    care: ['Check the included items before ordering.', 'Natural salt pieces vary in colour, texture, and weight.', 'Keep items dry and follow the care notes for the product type included.'],
    promise: 'A simpler route for buyers who want the Salty Lamps look with less decision fatigue.',
  },
  panel: {
    lede: name => `${name} is illuminated Himalayan salt wall art — ancient rock salt carved into a hand-finished solid-wood frame. Each panel is a unique piece of nature, with mineral veining that ranges from pale pink to deep orange, and a warm glow that changes the feel of a room the moment it is lit.`,
    useTitle: 'Where it works best',
    uses: ['Living rooms, bedrooms, and home offices that want a warmer, calmer feel.', 'Gyms, yoga studios, and wellness spaces where a soft glow sets the tone.', 'Reception areas and interiors projects that want a natural statement piece.'],
    careTitle: 'Setup and care',
    care: ['Keep the panel dry and wipe gently with a dry cloth.', 'Avoid prolonged exposure to humidity — mount securely with the supplied fittings.', 'Natural variation in colour, veining, and texture is normal; no two panels are alike.'],
    promise: 'A unique piece of nature, framed by hand, bringing warmth and timeless character to any wall.',
  },
}

const productSellingContent = product => {
  const theme = themeForProduct(product)
  const content = sellingContentByTheme[theme] || sellingContentByTheme.lamp
  const category = categoryName(primaryCategory(product))
  return {
    ...content,
    category,
    lede: content.lede(product.name),
  }
}

const productVisibleReviews = product => {
  const primary = productProof(product)
  return [primary, ...featuredReviews.filter(review => review.name !== primary.name)].slice(0, 3)
}

const persistSubmission = async (table, payload) => {
  const submission = {
    ...payload,
    createdAt: new Date().toISOString(),
  }

  try {
    const key = `salty-lamps-${table}`
    const existing = JSON.parse(window.localStorage.getItem(key) || '[]')
    window.localStorage.setItem(key, JSON.stringify([submission, ...existing].slice(0, 80)))
  } catch {
    // Local storage can be blocked in private browsing, so the email fallback still carries the enquiry.
  }

  if (!supabase) return

  const { error } = await supabase.from(table).insert({
    ...payload,
    created_at: submission.createdAt,
  })

  if (error) throw error
}



const processSteps = [
  {
    label: 'Mine',
    title: 'Mined rock salt',
    text: 'Raw rock salt is extracted from mines and loaded onto trucks for the first leg of the journey.',
  },
  {
    label: 'Sort',
    title: 'Warehouse sorting',
    text: 'The material reaches the Karachi warehouse, where it is washed, dried, and separated by colour and quality.',
  },
  {
    label: 'Cut',
    title: 'Cut and shaped',
    text: 'Rock salt is cut into natural lamps, specific shapes, bowls, bricks, tiles, and other product forms.',
  },
  {
    label: 'Finish',
    title: 'Hand finished',
    text: 'Each cut piece is carefully hand-crafted by skilled workmen so the natural material keeps its character.',
  },
  {
    label: 'Pack',
    title: 'Packed for export',
    text: 'Finished pieces are shrink wrapped, boxed, palletized, and sent to the port for export.',
  },
]

const processProofPoints = [
  {
    stat: 'Handled',
    title: 'Real labour at every stage',
    text: 'The film shows the physical movement behind the product: lifting, rinsing, sorting, cutting, finishing, and packing.',
  },
  {
    stat: 'Checked',
    title: 'Natural material, judged piece by piece',
    text: 'Colour, clarity, size, grain, and fractures all affect what each piece can become.',
  },
  {
    stat: 'Finished',
    title: 'Machine cut, human refined',
    text: 'The work keeps the irregular mineral character while making each item ready for use or display.',
  },
  {
    stat: 'Arrived',
    title: 'From workshop to home',
    text: 'The close is not another step list: it brings the journey home as a finished object with warmth and presence.',
  },
]

const processProductRanges = [
  {
    title: 'Rock salt lamps',
    text: 'Warm amber lighting for bedrooms, lounges, desks, treatment rooms, and gift shelves.',
  },
  {
    title: 'Candle holders',
    text: 'Natural tealight pieces for tables, baths, shelves, spa corners, and calming evening settings.',
  },
  {
    title: 'Bowls and kitchen saltware',
    text: 'Serving, cooking, and presentation pieces that bring mineral texture into everyday food moments.',
  },
  {
    title: 'Culinary and bath salts',
    text: 'Pure Himalayan salt formats for cooking, bathing, gifting, and simple personal-care routines.',
  },
  {
    title: 'Cooking platters',
    text: 'Salt slabs for grilling, chilling, serving, and adding a gentle natural salt character to food.',
  },
  {
    title: 'Bricks and curing tiles',
    text: 'Trade-ready salt blocks for butchers, dry-ageing, display, interiors, and specialist supply.',
  },
  {
    title: 'Spa salt walls',
    text: 'Custom salt wall installations for spas, wellness rooms, yoga studios, and treatment spaces.',
  },
  {
    title: 'Horse and cattle licks',
    text: 'Natural mineral salt blocks and loose forms for yards, fields, livestock, and repeat rural supply.',
  },
]

const productMatchesPath = (product, path) => product.categories.some(slug => path.categories.includes(slug))

const hasTag = (product, tags) => (product.tags || []).some(tag => tags.includes(tag))

// Declarative grouping for each collection landing. Sections render in order;
// a section may split into labelled sub-bands. A subgroup without `match` is the
// catch-all "rest". Assignment is first-match, so a product appears once.
const collectionSectionConfig = {
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
      subgroups: [
        { label: 'Natural, classic & bestselling', match: product => hasTag(product, ['Bestseller', 'Classic', 'Premium']) },
        { label: 'Decorative, sculptural & gift shapes' },
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
      match: product => hasTag(product, ['Hosting', 'Serving']),
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
      match: product => hasTag(product, ['Pantry', 'Barware']),
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
      match: product => product.categories.includes('equestrian-salt-licks') && product.id !== 'salty-licks-special',
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
      match: product => product.id === 'salty-licks-special',
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
    },
  ],
}

// Build labelled sections for a collection landing. In-stock items sort ahead of
// out-of-stock (stable, so the chosen sort order is preserved within each group).
// Falls back to a single unlabelled section when no config exists, and sweeps any
// unassigned products into a trailing section so nothing is ever dropped.
const buildCollectionSections = (slug, items) => {
  const ordered = [...items].sort((a, b) => (a.stock === b.stock ? 0 : a.stock ? -1 : 1))
  const config = collectionSectionConfig[slug]
  if (!config) {
    return [{ title: null, descriptor: null, count: ordered.length, groups: [{ label: null, products: ordered }] }]
  }

  const assigned = new Set()
  const sections = []
  for (const section of config) {
    const sectionItems = ordered.filter(product => !assigned.has(product.id) && section.match(product))
    if (!sectionItems.length) continue
    sectionItems.forEach(product => assigned.add(product.id))

    let groups
    if (section.subgroups) {
      const used = new Set()
      groups = section.subgroups
        .map(subgroup => {
          const groupItems = sectionItems.filter(
            product => !used.has(product.id) && (subgroup.match ? subgroup.match(product) : true),
          )
          groupItems.forEach(product => used.add(product.id))
          return { label: subgroup.label, products: groupItems }
        })
        .filter(group => group.products.length)
      // Collapse to a flat grid when only one band actually has products.
      if (groups.length <= 1) groups = [{ label: null, products: sectionItems }]
    } else {
      groups = [{ label: null, products: sectionItems }]
    }

    sections.push({
      id: section.id,
      title: section.title,
      descriptor: section.descriptor,
      cardText: section.cardText,
      recommendation: section.recommendation,
      image: section.image,
      theme: section.theme,
      categorySlug: section.categorySlug,
      count: sectionItems.length,
      groups,
    })
  }

  const leftover = ordered.filter(product => !assigned.has(product.id))
  if (leftover.length) {
    sections.push({ title: 'More in this range', descriptor: null, count: leftover.length, groups: [{ label: null, products: leftover }] })
  }
  return sections
}


const categoryPageCopy = slug => {
  const category = categories.find(item => item.slug === slug)
  if (!category || slug === 'all-products') return pageCopy.shop

  return {
    eyebrow: category.name,
    title: `Shop ${category.name.toLowerCase()} from Salty Lamps.`,
    description: category.description,
  }
}

const activePageMeta = ({ route, categorySlug, activeShopperPath, currentProduct, page }) => {
  if (currentProduct) {
    return {
      title: pageTitle(currentProduct.name),
      description: currentProduct.description,
      image: currentProduct.image,
      type: 'product',
    }
  }

  if (activeShopperPath) {
    return {
      title: pageTitle(activeShopperPath.name),
      description: activeShopperPath.description,
      image: activeShopperPath.background,
    }
  }

  if (categorySlug) {
    const category = categories.find(item => item.slug === categorySlug)
    const copy = categoryPageCopy(categorySlug)
    return {
      title: pageTitle(copy.title),
      description: copy.description,
      image: category?.image || media('logo.png'),
    }
  }

  if (route === '/shop') return { title: pageTitle('Shop'), description: pageCopy.shop.description, image: img('lamp-sphere-gemini.jpg') }
  if (route === '/gallery') return { title: pageTitle('Gallery'), description: 'Browse Salty Lamps product details, lifestyle scenes, and trade-use references.', image: media('yoga-room.png') }
  if (route.startsWith('/admin')) return { title: pageTitle('Admin'), description: 'Salty Lamps admin portal.', image: media('logo.png'), robots: 'noindex,nofollow' }
  if (route === '/process') return { title: pageTitle('Manufacturing Process'), description: 'See how Salty Lamps products move from mined rock salt to cut, finished, packed products.', image: media('video/salty-lamps-manufacturing-process-poster-16x9.jpg') }
  if (route === '/reviews') return { title: pageTitle('Customer Reviews'), description: 'Read verified Salty Lamps guestbook feedback by customer theme.', image: img('lamp-natural-gemini.jpg') }
  if (route === '/returns-exchanges' || route === '/return-refund-policy') return { title: pageTitle('Returns and Exchanges'), description: 'Review Salty Lamps return and exchange next steps.', image: media('logo.png') }
  if (route === '/checkout/success') return { title: pageTitle('Order Confirmed'), description: 'Your Salty Lamps order is confirmed.', image: media('logo.png'), robots: 'noindex,follow' }
  if (route === '/checkout/cancelled') return { title: pageTitle('Checkout Cancelled'), description: 'Your Salty Lamps checkout was cancelled.', image: media('logo.png'), robots: 'noindex,follow' }
  if (page) return { title: pageTitle(page.title), description: page.body[0], image: media('logo.png') }
  if (route === '/') return { title: siteTitle, description: siteDescription, image: media('video/salty-lamps-homepage-hero-poster-16x9.jpg') }
  return { title: pageTitle(pageCopy.notFound.title), description: pageCopy.notFound.description, image: media('logo.png'), robots: 'noindex,follow' }
}

const productReassurance = product => reassuranceByTheme[themeForProduct(product)] || reassuranceByTheme.lamp

const productProof = product => proofByTheme[themeForProduct(product)] || featuredReviews[0]

function getRoute() {
  return window.location.pathname === '/index.html' ? '/' : window.location.pathname
}

function absoluteUrl(path) {
  return `${siteUrl}${path}`
}

function ensureMeta(selector, createElement, attrs = {}) {
  let element = document.querySelector(selector)
  if (!element) {
    element = document.createElement(createElement)
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value))
    document.head.appendChild(element)
  }
  return element
}

function setMeta(selector, createAttrs, valueAttr, value) {
  const element = ensureMeta(selector, 'meta', createAttrs)
  element.setAttribute(valueAttr, value)
}

function Link({ href, children, className, onClick, ...props }) {
  const handleClick = event => {
    if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.includes('#')) {
      onClick?.(event)
      return
    }
    event.preventDefault()
    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    onClick?.(event)
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

function ProductCard({ product, onQuickView, onAdd, variant = '' }) {
  const groupSlug = primaryCategory(product)
  const groupName = categoryName(groupSlug)
  const variantClass = variant ? ` product-card--${variant}` : ''

  return (
    <article className={`product-card theme-${themeForProduct(product)}${variantClass}${product.stock ? '' : ' is-soldout'}`}>
      <Link className="product-image" href={`/product-page/${product.slug}`} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} />
        <span>{product.stock ? product.tags[0] : 'Out of stock'}</span>
      </Link>
      <div className="product-body">
        <p>{groupName}</p>
        <h3>{product.name}</h3>
        <span>{product.description}</span>
      </div>
      <div className="product-meta">
        <strong>{priceLabel(product)}</strong>
        <small>{product.stock ? 'In stock' : 'Currently unavailable'}</small>
      </div>
      <div className="product-actions">
        <button type="button" onClick={() => onQuickView(product.id)}>View</button>
        <button type="button" onClick={() => onAdd(product)} disabled={!product.stock || product.priceTBD}>
          {product.options?.length ? 'Choose' : 'Add'}
        </button>
      </div>
    </article>
  )
}

function ChatModule({ onSubmit, message }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`chat-module ${open ? 'open' : ''}`}>
      {open && (
        <form className="chat-panel" onSubmit={onSubmit}>
          <div className="chat-panel-header">
            <div>
              <p className="eyebrow">Salty Lamps support</p>
              <strong>Ask us about products, trade, or orders.</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">Close</button>
          </div>
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Message
            <textarea name="message" rows="4" placeholder="Tell us what you are looking for..." required />
          </label>
          <button type="submit">Send message</button>
          <a href="mailto:info@saltylamps.co.uk?subject=Website%20chat%20request">Open email instead</a>
          {message && <p className="success">{message}</p>}
        </form>
      )}
      <button className="chat-button" type="button" onClick={() => setOpen(current => !current)}>
        {open ? 'Close Chat' : "Let's Chat"}
      </button>
    </div>
  )
}

function OptionSelectors({ product, selected, onSelect }) {
  if (!product.options?.length) return null

  return (
    <div className="option-stack">
      {product.options.map(option => (
        <label key={option.name}>
          {option.name}
          <select
            value={selected[option.name] || ''}
            onChange={event => onSelect(option.name, event.target.value)}
            required
          >
            <option value="">Select {option.name}</option>
            {option.values.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  )
}

const collectionTradeCopy = {
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

function CollectionTradeCta({ path }) {
  const content = collectionTradeCopy[path.slug]
  if (!content) return null
  return (
    <aside className={`collection-trade-cta theme-${path.theme}`}>
      <div>
        <p className="eyebrow">{content.eyebrow}</p>
        <h3>{content.heading}</h3>
        <p>{content.body}</p>
      </div>
      <a
        className="button primary"
        href={`mailto:info@saltylamps.co.uk?subject=${encodeURIComponent(content.cta)}`}
      >
        {content.cta}
      </a>
    </aside>
  )
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [quickViewId, setQuickViewId] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState({})
  const [formMessage, setFormMessage] = useState('')
  const [newsletterMessage, setNewsletterMessage] = useState('')
  const [chatMessage, setChatMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [heroPlaying, setHeroPlaying] = useState(false)
  const [heroPosterFailed, setHeroPosterFailed] = useState(false)
  const [homeHeroPlaying, setHomeHeroPlaying] = useState(false)
  const [homeHeroPosterFailed, setHomeHeroPosterFailed] = useState(false)
  const [processFilmPlaying, setProcessFilmPlaying] = useState(false)
  const [processFilmPosterFailed, setProcessFilmPosterFailed] = useState(false)
  const [activeCollectionSection, setActiveCollectionSection] = useState('all')

  useEffect(() => {
    const updateRoute = () => setRoute(getRoute())
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data.products || []))
      .catch(() => setProducts([]))
  }, [])

  const categorySlug = route.startsWith('/category/') ? resolveCategorySlug(route.replace('/category/', '')) : null
  const collectionMatch = route.match(/^\/collection\/([^/]+)(?:\/([^/]+))?$/)
  const collectionSlug = collectionMatch?.[1] || null
  const collectionCategorySlug = collectionMatch?.[2] ? resolveCategorySlug(collectionMatch[2]) : null
  const activeShopperPath = shopperPaths.find(path => path.slug === collectionSlug)

  // Reset video state whenever the collection changes.
  useEffect(() => {
    setHeroPlaying(false)
    setHeroPosterFailed(false)
  }, [collectionSlug])

  useEffect(() => {
    if (route !== '/') setHomeHeroPlaying(false)
    if (route !== '/process') setProcessFilmPlaying(false)
  }, [route])

  const productSlug = route.startsWith('/product-page/') ? route.replace('/product-page/', '') : null
  const currentProduct = products.find(product => product.slug === productSlug)
  const quickViewProduct = products.find(product => product.id === quickViewId)
  const page = pages[route]
  const isKnownCategoryRoute = !categorySlug || categories.some(category => category.slug === categorySlug)
  const notFound =
    !currentProduct &&
    !activeShopperPath &&
    !page &&
    route !== '/' &&
    route !== '/shop' &&
    route !== '/gallery' &&
    !route.startsWith('/admin') &&
    route !== '/process' &&
    route !== '/reviews' &&
    route !== '/returns-exchanges' &&
    route !== '/return-refund-policy' &&
    route !== '/checkout/success' &&
    route !== '/checkout/cancelled' &&
    !(categorySlug && isKnownCategoryRoute)
  const meta = notFound
    ? { title: pageTitle(pageCopy.notFound.title), description: pageCopy.notFound.description, image: media('logo.png'), robots: 'noindex,follow' }
    : activePageMeta({ route, categorySlug, activeShopperPath, currentProduct, page })
  const canonicalPath = currentProduct
    ? `/product-page/${currentProduct.slug}`
    : collectionSlug
      ? collectionCategorySlug
        ? collectionCategoryHref(collectionSlug, collectionCategorySlug)
        : `/collection/${collectionSlug}`
      : categorySlug
        ? categoryHref(categorySlug)
        : route === '/returns-exchanges'
          ? '/return-refund-policy'
          : route
  const galleryItems = useMemo(
    () => [
      ...products.slice(0, 18).map((product, index) => ({
        key: product.id,
        name: product.name,
        image: product.image,
        href: `/product-page/${product.slug}`,
        label: categoryName(primaryCategory(product)),
        variant: index % 7 === 0 ? 'wide' : index % 5 === 0 ? 'tall' : '',
      })),
      ...categories.slice(1, 7).map((category, index) => ({
        key: category.slug,
        name: category.name,
        image: category.image,
        href: categoryHref(category.slug),
        label: category.name,
        variant: index % 3 === 0 ? 'wide' : '',
      })),
    ],
    [products],
  )
  const galleryShowcaseItems = useMemo(
    () => [
      {
        key: 'home-gifts',
        label: 'Home showcase',
        title: 'Warm rooms, quiet corners, and giftable glow.',
        body: 'Styled lamps and holders for homes, spas, kitchens, and calm retail displays.',
        image: media('yoga-room.png'),
        href: '/collection/home-gifts',
      },
      {
        key: 'kitchen-saltware',
        label: 'Kitchen saltware',
        title: 'Saltware for cooking, serving, and table theatre.',
        body: 'Bowls, platters, shot glasses, and pantry pieces shown in real hosting moments.',
        image: img('salty-chef-family-live-site.png'),
        href: '/collection/kitchen-food',
      },
      {
        key: 'trade-spa',
        label: 'Trade and spa',
        title: 'Salt walls, tiles, bricks, and bulk project supply.',
        body: 'A more architectural look at how the range works for wellness and trade spaces.',
        image: media('home-spa-salt-room-generated.png'),
        href: '/collection/trade-spa',
      },
      {
        key: 'yard-supply',
        label: 'Equestrian',
        title: 'Field, stable, and smallholding supply.',
        body: 'Natural salt licks and yard-ready essentials for repeat rural buyers.',
        image: media('home-horse-salt-lick-generated.png'),
        href: '/collection/horses-farm',
      },
    ],
    [],
  )

  const categoryFilter =
    collectionCategorySlug || (categorySlug && categorySlug !== 'all-products' ? categorySlug : 'all')
  const sidebarCategories = activeShopperPath
    ? categories.filter(category => activeShopperPath.categories.includes(category.slug))
    : categories
  const collectionProducts = activeShopperPath ? products.filter(product => productMatchesPath(product, activeShopperPath)) : products

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase()
    let list = products.filter(product => {
      const matchesCollection = !activeShopperPath || productMatchesPath(product, activeShopperPath)
      const matchesCategory = categoryFilter === 'all' || product.categories.includes(categoryFilter)
      const haystack = `${product.name} ${product.description} ${product.tags.join(' ')}`.toLowerCase()
      return matchesCollection && matchesCategory && haystack.includes(term)
    })

    if (sort === 'price-low') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'price-high') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))

    return list
  }, [products, activeShopperPath, categoryFilter, query, sort])

  // The collection landing (no sub-category, no search) shows the hero + grouped
  // sections; any drill-down or search falls back to the flat result grid.
  const isCollectionRoot = Boolean(activeShopperPath) && categoryFilter === 'all' && !query.trim()
  const collectionSections = isCollectionRoot ? buildCollectionSections(activeShopperPath.slug, visibleProducts) : []
  const collectionSectionKey = collectionSections
    .map(section => `${section.id || ''}:${section.categorySlug || ''}`)
    .join('|')

  useEffect(() => {
    document.title = meta.title
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', meta.description)
    const canonical = ensureMeta('link[rel="canonical"]', 'link', { rel: 'canonical' })
    const canonicalUrl = absoluteUrl(canonicalPath)
    canonical.setAttribute('href', canonicalUrl)
    setMeta('meta[name="robots"]', { name: 'robots' }, 'content', meta.robots || 'index,follow')
    setMeta('meta[property="og:type"]', { property: 'og:type' }, 'content', meta.type || 'website')
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'content', 'Salty Lamps')
    setMeta('meta[property="og:title"]', { property: 'og:title' }, 'content', meta.title)
    setMeta('meta[property="og:description"]', { property: 'og:description' }, 'content', meta.description)
    setMeta('meta[property="og:url"]', { property: 'og:url' }, 'content', canonicalUrl)
    setMeta('meta[property="og:image"]', { property: 'og:image' }, 'content', absoluteUrl(meta.image || media('logo.png')))
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'content', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, 'content', meta.title)
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, 'content', meta.description)
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, 'content', absoluteUrl(meta.image || media('logo.png')))
    document.querySelector('script[data-prerender-jsonld]')?.remove()
  }, [canonicalPath, meta.description, meta.image, meta.robots, meta.title, meta.type])

  useEffect(() => {
    if (!isCollectionRoot || !collectionSections.length) {
      setActiveCollectionSection('all')
      return undefined
    }

    let frame = 0
    const sectionTargets = collectionSections
      .filter(section => section.id)
      .map(section => ({ id: section.id }))

    const updateActiveSection = () => {
      frame = 0
      const activationY = window.innerHeight * 0.62
      let nextSection = 'all'
      let closestSectionTop = Number.NEGATIVE_INFINITY
      const isNearPageEnd =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12

      for (const section of sectionTargets) {
        const element = document.getElementById(section.id)
        if (!element) continue

        const rect = element.getBoundingClientRect()
        if (rect.top <= activationY && rect.top > closestSectionTop) {
          closestSectionTop = rect.top
          nextSection = section.id
        }
      }

      if (isNearPageEnd && sectionTargets.length) {
        nextSection = sectionTargets[sectionTargets.length - 1].id
      }

      setActiveCollectionSection(current => (current === nextSection ? current : nextSection))
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [isCollectionRoot, collectionSectionKey])

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0)

  const selectOption = (productId, optionName, value) => {
    setSelectedOptions(current => ({
      ...current,
      [productId]: {
        ...(current[productId] || {}),
        [optionName]: value,
      },
    }))
    setNotice('')
  }

  const hasRequiredOptions = product => {
    if (!product.options?.length) return true
    const selected = selectedOptions[product.id] || {}
    return product.options.every(option => selected[option.name])
  }

  const addProduct = (product, context = 'grid') => {
    if (!product.stock) return

    if (product.options?.length && !hasRequiredOptions(product)) {
      setNotice(`Select ${product.options[0].name} before adding this item.`)
      if (context === 'grid') {
        setQuickViewId(product.id)
      }
      return
    }

    const options = selectedOptions[product.id] || {}
    const key = `${product.id}:${JSON.stringify(options)}`

    setCart(items => {
      const existing = items.find(item => item.key === key)
      if (existing) {
        return items.map(item => (item.key === key ? { ...item, qty: item.qty + 1 } : item))
      }
      return [...items, { key, product, options, qty: 1 }]
    })
    setCartOpen(true)
    setQuickViewId(null)
    setNotice('')
  }

  const handleTradeSubmit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = {
      name: data.get('name'),
      email: data.get('email'),
      interest: data.get('interest'),
      message: data.get('message'),
      source: 'trade-form',
    }

    try {
      await persistSubmission('trade_enquiries', payload)
    } finally {
      setFormMessage(
        hasSupabase
          ? 'Thanks for submitting. We will come back to you shortly.'
          : 'Your enquiry is captured in this dev build. Connect the Wix form before launch.',
      )
      event.currentTarget.reset()
    }
  }

  const handleNewsletterSubmit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    try {
      await persistSubmission('newsletter_signups', {
        email: data.get('email'),
        source: 'footer-newsletter',
      })
    } finally {
      setNewsletterMessage(
        hasSupabase
          ? 'Thanks for subscribing.'
          : 'Signup checked locally. Connect Wix Contacts before launch.',
      )
      event.currentTarget.reset()
    }
  }

  const handleChatSubmit = async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    try {
      await persistSubmission('chat_messages', {
        name: data.get('name'),
        email: data.get('email'),
        message: data.get('message'),
        source: 'floating-chat',
      })
    } finally {
      setChatMessage(
        hasSupabase
          ? 'Message saved. We will reply as soon as possible.'
          : 'Message checked locally. Connect Wix Smart Chat before launch.',
      )
      event.currentTarget.reset()
    }
  }

  const changeQty = (key, delta) => {
    setCart(items =>
      items
        .map(item => (item.key === key ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter(item => item.qty > 0),
    )
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    setNotice('')
    try {
      const items = cart.map(item => ({ skuId: item.product.skuId, quantity: item.qty }))
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || 'Checkout failed. Please try again.')
        setCheckoutLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setNotice('Checkout failed. Please try again.')
      setCheckoutLoading(false)
    }
  }

  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Salty Lamps',
    url: `${siteUrl}/`,
    telephone: '01782970001',
    email: 'info@saltylamps.co.uk',
    image: absoluteUrl(media('logo.png')),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Unit 41, Imex Business Park, Ormonde Street',
      addressLocality: 'Stoke-on-Trent',
      postalCode: 'ST4 3NP',
      addressCountry: 'GB',
    },
  }

  const productSchema = currentProduct && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: currentProduct.name,
    sku: currentProduct.sku || undefined,
    image: [absoluteUrl(currentProduct.image)],
    description: currentProduct.description,
    brand: {
      '@type': 'Brand',
      name: 'Salty Lamps',
    },
    // Omit the Offer entirely when pricing is TBD — publishing a placeholder
    // price to search engines would be worse than publishing none.
    offers: currentProduct.priceTBD ? undefined : {
      '@type': 'Offer',
      url: absoluteUrl(`/product-page/${currentProduct.slug}`),
      price: currentProduct.price,
      priceCurrency: 'GBP',
      availability: currentProduct.stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Salty Lamps Ltd',
      },
    },
  }

  const listSchema = (route === '/shop' || activeShopperPath || categorySlug) && visibleProducts.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: meta.title.replace(' | Salty Lamps', ''),
        description: meta.description,
        url: absoluteUrl(canonicalPath),
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: visibleProducts.slice(0, 48).map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/product-page/${product.slug}`),
            name: product.name,
          })),
        },
      }
    : null

  const processSchema = route === '/process'
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: 'Salty Lamps Manufacturing Process',
        description: 'Manufacturing process for Salty Lamps Himalayan rock salt products, from raw rock salt through sorting, cutting, finishing, packing, and export.',
        thumbnailUrl: [absoluteUrl(media('video/salty-lamps-manufacturing-process-poster-16x9.jpg'))],
        uploadDate: '2026-06-22',
        contentUrl: absoluteUrl(media('video/salty-lamps-manufacturing-process-16x9.mp4')),
      }
    : null

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [storeSchema, productSchema, listSchema, processSchema].filter(Boolean),
  }

  const renderShop = () => {
    const shopCopy = categorySlug && isKnownCategoryRoute ? categoryPageCopy(categorySlug) : pageCopy.shop
    const selectedCategoryCopy = categoryFilter !== 'all' ? categoryPageCopy(categoryFilter) : null
    const shopHeadingEyebrow = selectedCategoryCopy
      ? selectedCategoryCopy.eyebrow
      : activeShopperPath
        ? activeShopperPath.eyebrow
        : shopCopy.eyebrow
    const shopHeadingTitle = selectedCategoryCopy
      ? activeShopperPath
        ? `${selectedCategoryCopy.eyebrow} for ${activeShopperPath.shortName.toLowerCase()}`
        : selectedCategoryCopy.title
      : activeShopperPath
        ? activeShopperPath.heading
        : shopCopy.title
    const shopHeadingDescription = selectedCategoryCopy
      ? selectedCategoryCopy.description
      : activeShopperPath
        ? activeShopperPath.description
        : shopCopy.description
    const spotlightCategories = (
      activeShopperPath
        ? categories.filter(category => activeShopperPath.categories.includes(category.slug))
        : categories.filter(category => category.slug !== 'all-products')
    ).slice(0, 3)
    const renderCard = (product, variant) => (
      <ProductCard
        key={product.id}
        product={product}
        variant={variant}
        onQuickView={id => {
          setQuickViewId(id)
          setNotice('')
        }}
        onAdd={addProduct}
      />
    )

    return (
      <>
        {isCollectionRoot && (
          <section className="collection-hero">
            <div className="collection-hero-copy">
              <p className="eyebrow">{activeShopperPath.eyebrow}</p>
              <h1>{activeShopperPath.name}</h1>
              <p>
                {activeShopperPath.heroIntro.map((part, index) =>
                  typeof part === 'string'
                    ? part
                    : <strong key={index} className="hero-hl">{part.hl}</strong>,
                )}
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#shop">Shop the range</a>
                <a className="button secondary" href="/#trade">Trade enquiries</a>
              </div>
            </div>
            <div className="collection-hero-video">
              {heroPlaying ? (
                <video
                  className="collection-hero-video__player"
                  playsInline
                  autoPlay
                  controls
                  onEnded={() => setHeroPlaying(false)}
                  src={activeShopperPath.heroVideo}
                />
              ) : heroPosterFailed ? (
                <div className="video-facade video-facade--static">
                  <img
                    className="video-facade__poster"
                    src={activeShopperPath.background}
                    alt=""
                  />
                  <span className="video-facade__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                    </svg>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="video-facade"
                  onClick={() => setHeroPlaying(true)}
                  aria-label={`Play the ${activeShopperPath.shortName} film`}
                >
                  <img
                    className="video-facade__poster"
                    src={activeShopperPath.heroPoster}
                    alt=""
                    loading="lazy"
                    onError={() => setHeroPosterFailed(true)}
                  />
                  <span className="video-facade__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </section>
        )}
        <section className="commerce-layout" id="shop">
          <div className={`shop-layout-head theme-${activeShopperPath?.theme || 'lamp'}`}>
            <div className="shop-layout-copy">
              <p className="eyebrow">{shopHeadingEyebrow}</p>
              {isCollectionRoot ? <h2>{shopHeadingTitle}</h2> : <h1>{shopHeadingTitle}</h1>}
              <p>{shopHeadingDescription}</p>
            </div>
            <div className="shop-layout-aside" aria-label="Shop highlights">
              <div className="shop-layout-stats">
                <span><strong>{visibleProducts.length}</strong> shown</span>
                <span><strong>{activeShopperPath ? activeShopperPath.shortName : categories.length - 1}</strong> {activeShopperPath ? 'buyer path' : 'categories'}</span>
                <span><strong>Trade</strong> bulk supply</span>
              </div>
              <div className="shop-layout-rail" aria-label="Featured categories">
                {spotlightCategories.map(category => (
                  <Link
                    key={category.slug}
                    href={activeShopperPath ? collectionCategoryHref(activeShopperPath.slug, category.slug) : categoryHref(category.slug)}
                  >
                    <img src={category.image} alt="" loading="lazy" />
                    <span>{category.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
      <aside className="shop-sidebar" aria-label="Shop filters">
        <div className="sidebar-heading">
          <p className="eyebrow">{activeShopperPath ? activeShopperPath.shortName : 'Shop controls'}</p>
          <span>{visibleProducts.length} shown</span>
        </div>
        {activeShopperPath && (
          <div className={`path-context theme-${activeShopperPath.theme}`}>
            <strong>{activeShopperPath.name}</strong>
            <p>{activeShopperPath.description}</p>
            <Link href="/shop">View full shop</Link>
          </div>
        )}
        <label>
          Search products
          <input
            type="search"
            placeholder="Lamp, holder, lick, brick..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
            <option value="name">Name</option>
          </select>
        </label>
        <div className="filter-list" aria-label={isCollectionRoot ? 'Collection sections' : 'Product categories'}>
          <Link
            href={activeShopperPath ? `/collection/${activeShopperPath.slug}` : '/shop'}
            className={`${categoryFilter === 'all' && (!isCollectionRoot || activeCollectionSection === 'all') ? 'active' : ''} theme-${activeShopperPath?.theme || 'lamp'}`}
          >
            <span>{activeShopperPath ? `All ${activeShopperPath.shortName}` : 'All products'}</span>
            <small>{collectionProducts.length}</small>
          </Link>
          {isCollectionRoot ? (
            collectionSections.map(section => (
              <a
                key={section.id || section.title}
                href={`#${section.id || 'collection-products'}`}
                className={`${activeCollectionSection === section.id ? 'active' : ''} theme-${section.theme || activeShopperPath.theme}`}
                onClick={() => setActiveCollectionSection(section.id || 'all')}
              >
                <span>{section.title}</span>
                <small>{section.count}</small>
              </a>
            ))
          ) : (
            sidebarCategories.filter(category => category.slug !== 'all-products').map(category => (
              <Link
                key={category.slug}
                href={activeShopperPath ? collectionCategoryHref(activeShopperPath.slug, category.slug) : categoryHref(category.slug)}
                className={`${categoryFilter === category.slug ? 'active' : ''} theme-${groupThemes[category.slug] || 'lamp'}`}
              >
                <span>{category.name}</span>
                <small>
                  {collectionProducts.filter(product => product.categories.includes(category.slug)).length}
                </small>
              </Link>
            ))
          )}
        </div>
      </aside>
      <div className="shop-main">
        {!isCollectionRoot && (
          <nav className="shop-mobile-jump" aria-label="Quick category links">
            <Link href="/shop" className={categoryFilter === 'all' ? 'active' : ''}>All</Link>
            {sidebarCategories.filter(category => category.slug !== 'all-products').map(category => (
              <Link
                key={category.slug}
                href={activeShopperPath ? collectionCategoryHref(activeShopperPath.slug, category.slug) : categoryHref(category.slug)}
                className={categoryFilter === category.slug ? 'active' : ''}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
        {isCollectionRoot ? (
          <>
            <nav className="collection-path-cards" aria-label={`Shop ${activeShopperPath.name} by need`}>
              {collectionSections.map(section => (
                <a className="collection-path-card" href={`#${section.id || 'collection-products'}`} key={section.id || section.title}>
                  {section.image && <img src={section.image} alt="" loading="lazy" />}
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.count} shown</small>
                  </span>
                  {section.cardText && <p>{section.cardText}</p>}
                </a>
              ))}
            </nav>
            <div className="shop-sections">
              {collectionSections.map(section => (
                <section className={`shop-section theme-${section.theme || activeShopperPath.theme}`} id={section.id || undefined} key={section.title || 'all'}>
                  {section.title && (
                    <div className="shop-section-head">
                      <h3>
                        {section.title} <span>{section.count}</span>
                      </h3>
                      {section.descriptor && <p>{section.descriptor}</p>}
                    </div>
                  )}
                  <div className="shop-section-layout">
                    <aside className="shop-section-guide">
                      {section.image && <img src={section.image} alt="" loading="lazy" />}
                      <div>
                        <p className="eyebrow">Recommended route</p>
                        <strong>{section.cardText}</strong>
                        {section.recommendation && <p>{section.recommendation}</p>}
                      </div>
                      {section.categorySlug && (
                        <Link
                          className="shop-section-link"
                          href={collectionCategoryHref(activeShopperPath.slug, section.categorySlug)}
                        >
                          View only {section.title}
                        </Link>
                      )}
                    </aside>
                    <div className="shop-section-products">
                      {section.groups.map((group, index) => (
                        <div className="shop-subgroup" key={group.label || index}>
                          {group.label && <p className="shop-subgroup-label">{group.label}</p>}
                          <div className={`product-grid product-grid--section${group.products.length <= 2 ? ' product-grid--compact' : ''}`}>
                            {group.products.map(product => renderCard(product))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
            <CollectionTradeCta path={activeShopperPath} />
          </>
        ) : (
          <div className="product-grid">
            {visibleProducts.length ? (
              visibleProducts.map(renderCard)
            ) : (
              <div className="empty-state">
                <h3>No matching products</h3>
                <p>Try another search term or return to the full product range.</p>
                <Link className="button secondary" href="/shop">View all products</Link>
              </div>
            )}
          </div>
        )}
      </div>
        </section>
      </>
    )
  }

  const renderHome = () => (
    <>
      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">UK Himalayan salt products</p>
          <h1>Warm salt glow for homes, gifts, kitchens, spas, and trade projects.</h1>
          <p>
            Shop lamps, candle holders, saltware, salt bricks, accessories, and equestrian salt licks from Salty Lamps Ltd in Stoke-on-Trent.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/shop">Shop the full range</Link>
            <a className="button secondary" href="#trade">Request trade pricing</a>
          </div>
          <div className="hero-stats" aria-label="Store highlights">
            <span><strong>{products.length}</strong> products</span>
            <span><strong>Trade</strong> bulk orders</span>
            <span><strong>UK</strong> supplier</span>
          </div>
        </div>
        <div className="hero-video" aria-label="Salty Lamps product film">
          {homeHeroPlaying ? (
            <video
              playsInline
              autoPlay
              controls
              preload="metadata"
              onEnded={() => setHomeHeroPlaying(false)}
              poster="/media/video/salty-lamps-homepage-hero-poster-16x9.jpg"
            >
              <source src="/media/video/salty-lamps-homepage-hero-16x9.mp4" type="video/mp4" />
            </video>
          ) : homeHeroPosterFailed ? (
            <button
              type="button"
              className="video-facade video-facade--fallback"
              onClick={() => setHomeHeroPlaying(true)}
              aria-label="Play the Salty Lamps product film"
            >
              <span className="video-facade__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="video-facade"
              onClick={() => setHomeHeroPlaying(true)}
              aria-label="Play the Salty Lamps product film"
            >
              <img
                className="video-facade__poster"
                src="/media/video/salty-lamps-homepage-hero-poster-16x9.jpg"
                alt=""
                loading="eager"
                onError={() => setHomeHeroPosterFailed(true)}
              />
              <span className="video-facade__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="shopper-paths" aria-label="Shop by buyer type">
        <div className="shopper-paths-heading">
          <p className="eyebrow">Shop by what you need</p>
          <h2>Choose the range that fits your buyer journey.</h2>
        </div>
        {shopperPaths.map(path => (
          <Link key={path.slug} href={`/collection/${path.slug}`} className={`shopper-card theme-${path.theme}`}>
            <img className="shopper-card-bg" src={path.background} alt="" loading="lazy" />
            <span className="shopper-card-copy">
              <span>{path.eyebrow}</span>
              <strong>{path.name}</strong>
              <small>{path.description}</small>
            </span>
          </Link>
        ))}
      </section>


      <section className="trade-panel" id="trade">
        <div className="trade-copy">
          <p className="eyebrow">Trade and wholesale</p>
          <h2>Salt walls, bricks, licks, retail stock, and repeat supply.</h2>
          <p>
            Salty Lamps supports shops, spas, wellness rooms, butchers, equestrian suppliers, hospitality buyers, and interiors projects with product advice and bulk-order routes.
          </p>
          <div className="trade-media">
            <img src={media('trade-wholesale-showroom-generated.png')} alt="Trade showroom display with Himalayan salt walls, lamps, packaged stock, salt licks, and spa products" loading="lazy" />
            <span>Salt walls</span>
            <span>Retail stock</span>
            <span>Equestrian licks</span>
            <span>Spa supply</span>
          </div>
        </div>
        <form
          className="contact-card"
          onSubmit={handleTradeSubmit}
        >
          <label>
            Name
            <input name="name" type="text" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            What do you need?
            <select name="interest" defaultValue="">
              <option value=""></option>
              <option>Salt wall or bricks</option>
              <option>Retail lamps and holders</option>
              <option>Equestrian salt licks</option>
              <option>Kitchen and pantry stock</option>
            </select>
          </label>
          <label>
            Message
            <textarea name="message" rows="4" />
          </label>
          <button type="submit">Send trade enquiry</button>
          {formMessage && <p className="success">{formMessage}</p>}
        </form>
      </section>

      <section className="reviews-band" id="reviews">
        <div className="review-summary-card">
          <div className="review-summary-copy">
            <p className="eyebrow">Customer proof</p>
            <h2>Warm light, helpful service, and natural products people can inspect.</h2>
            <p>
              Based on {reviews.length} customer guestbook notes, with the strongest themes surfaced from the real wording customers left after buying.
            </p>
          </div>
          <div className="review-score">
            <strong>5.0</strong>
            <span>
              <span className="review-stars" aria-label="5 star featured reviews">★★★★★</span>
              <small>Featured guestbook rating</small>
            </span>
          </div>
          <div className="review-signals" aria-label="Common customer review themes">
            {reviewSignals.map(signal => (
              <div className="review-signal" key={signal.label}>
                <span>{signal.label}</span>
                <small>{signal.count} mentions</small>
                <i aria-hidden="true">
                  <b style={{ '--review-signal': `${signal.percent}%` }} />
                </i>
              </div>
            ))}
          </div>
          <div className="review-trust-row" aria-label="Review trust markers">
            <Link className="review-cta" href="/reviews">
              <svg width="38" height="38" viewBox="0 0 40 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <polygon points="20,4 24.1,14.3 35.2,15.1 26.7,22.2 29.4,33 20,27 10.6,33 13.3,22.2 4.8,15.1 15.9,14.3" />
              </svg>
              Read all {reviews.length} reviews
            </Link>
          </div>
        </div>
        <div className="featured-reviews">
          {featuredReviews.map(review => (
            <article className="featured-review" key={`${review.name}-${review.date}`}>
              <div className="review-card-header">
                <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
                <span>
                  <strong>{review.name}</strong>
                  <small>{review.date}</small>
                </span>
              </div>
              <div className="review-rating-row">
                <strong className="review-stars" aria-label="5 star review">★★★★★</strong>
                <span>5.0</span>
                <em>Verified</em>
              </div>
              <p>{review.quote}</p>
              <small className="review-proof">{review.proof}</small>
            </article>
          ))}
        </div>
      </section>
    </>
  )

  const renderProductPage = product => {
    const selected = selectedOptions[product.id] || {}
    const detailImages = supportImagesForProduct(product)
    const reassurance = productReassurance(product)
    const proof = productProof(product)
    const selling = productSellingContent(product)
    const visibleReviews = productVisibleReviews(product)

    return (
      <section className={`product-page theme-${themeForProduct(product)}`}>
        <div className="product-gallery">
          <div className="product-gallery-main">
            <img src={product.image} alt={product.name} />
            <span>{selling.category}</span>
          </div>
          <div className="product-gallery-thumbs">
            {detailImages.map(item => (
              <img key={item.src} src={item.src} alt={item.alt} />
            ))}
          </div>
        </div>
        <div className="product-detail">
          <div className="product-buy-panel">
            <p className="eyebrow">{product.tags.join(' / ')}</p>
            <h1>{product.name}</h1>
            <p className="product-lede">{selling.lede}</p>
            <div className="detail-meta">
              <strong>{priceLabel(product)}</strong>
              <span>{product.stock ? 'In stock' : 'Out of stock'}</span>
              {product.sku && <span>SKU {product.sku}</span>}
            </div>
            <OptionSelectors
              product={product}
              selected={selected}
              onSelect={(name, value) => selectOption(product.id, name, value)}
            />
            {notice && (quickViewId === product.id || currentProduct?.id === product.id) && <p className="notice">{notice}</p>}
            <div className="hero-actions product-cta-row">
              <button className="button primary" type="button" onClick={() => addProduct(product, 'product-page')} disabled={!product.stock || product.priceTBD}>
                Add to cart
              </button>
              <a className="button secondary" href={`mailto:info@saltylamps.co.uk?subject=${encodeURIComponent(product.name)}`}>
                Ask a question
              </a>
            </div>
            <div className="product-proof-strip">
              <span className="review-stars" aria-label="5 star customer proof">★★★★★</span>
              <p>{proof.quote}</p>
              <small>{proof.name} · {proof.proof}</small>
            </div>
          </div>

          <div className="product-selling-grid">
            <article>
              <span>{selling.useTitle}</span>
              <ul>
                {selling.uses.map(item => <li key={item}>{item}</li>)}
              </ul>
            </article>
            <article>
              <span>{selling.careTitle}</span>
              <ul>
                {selling.care.map(item => <li key={item}>{item}</li>)}
              </ul>
            </article>
            <article>
              <span>Why it is worth choosing</span>
              <p>{selling.promise}</p>
            </article>
          </div>

          <div className="product-info-panel">
            <article>
              <span>Product details</span>
              <p>{product.description} Natural Himalayan salt varies in colour, texture, and weight, so the product you receive will have its own tone and surface character.</p>
            </article>
            <article>
              <span>Buyer reassurance</span>
              <p>{reassurance.join(' ')}</p>
            </article>
            <article>
              <span>Delivery and support</span>
              <p>Contact Salty Lamps Ltd for order support, bulk enquiries, returns questions, and replacement bulbs or cables. If you are unsure about size, fitting, or trade quantities, ask before placing the order request.</p>
            </article>
          </div>

          <div className="product-review-panel" aria-label="Visible customer reviews">
            <div className="product-review-heading">
              <div>
                <p className="eyebrow">Customer proof</p>
                <h2>Real buyer notes before you add to cart.</h2>
              </div>
              <Link className="text-link" href="/reviews">Read all {reviews.length} reviews</Link>
            </div>
            <div className="product-review-grid">
              {visibleReviews.map(review => (
                <article key={`${product.id}-${review.name}-${review.date}`}>
                  <div className="review-card-header">
                    <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
                    <span>
                      <strong>{review.name}</strong>
                      <small>{review.date}</small>
                    </span>
                  </div>
                  <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
                  <p>{review.quote}</p>
                  <em>{review.proof}</em>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderGallery = () => {
    const [featuredGalleryItem, ...supportingGalleryItems] = galleryShowcaseItems

    return (
      <section className="gallery-page gallery-page--showcase">
        <div className="section-heading gallery-heading">
          <p className="eyebrow">Gallery</p>
          <h1>Product details, lifestyle scenes, and trade-use references.</h1>
          <p>Browse the range as a visual showcase, from finished room settings to close-up salt textures.</p>
        </div>

        <div className="gallery-showcase">
          <Link className="gallery-feature-card" href={featuredGalleryItem.href}>
            <img src={featuredGalleryItem.image} alt={featuredGalleryItem.title} />
            <span>{featuredGalleryItem.label}</span>
            <div>
              <h2>{featuredGalleryItem.title}</h2>
              <p>{featuredGalleryItem.body}</p>
            </div>
          </Link>

          <div className="gallery-story-stack" aria-label="Gallery themes">
            {supportingGalleryItems.map(item => (
              <Link className="gallery-story-card" key={item.key} href={item.href}>
                <img src={item.image} alt={item.title} loading="lazy" />
                <span>{item.label}</span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="gallery-section-heading">
          <div>
            <p className="eyebrow">Product close-ups</p>
            <h2>Shapes, finishes, and natural salt character.</h2>
          </div>
          <Link className="text-link" href="/shop">Shop the full range</Link>
        </div>

        <div className="gallery-grid gallery-mosaic">
          {galleryItems.map(item => (
            <Link className={`gallery-card ${item.variant ? `gallery-card--${item.variant}` : ''}`} key={item.key} href={item.href}>
              <img src={item.image} alt={item.name} loading="lazy" />
              <span>{item.label}</span>
              <strong>{item.name}</strong>
            </Link>
          ))}
        </div>
      </section>
    )
  }

  const renderPolicy = currentPage => (
    <section className="policy-page">
      <p className="eyebrow">Salty Lamps Ltd</p>
      <h1>{currentPage.title}</h1>
      {currentPage.body.map(paragraph => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <Link className="button secondary" href="/shop">Return to shop</Link>
    </section>
  )

  const renderReturnPolicy = () => (
    <section className="policy-page return-page">
      <p className="eyebrow">Returns and exchanges</p>
      <h1>Simple returns, clear next steps.</h1>
      <p>
        If you are not completely satisfied with your purchase, Salty Lamps can review a return for a refund or exchange when the item meets the policy conditions.
      </p>
      <div className="policy-highlights">
        <article>
          <span>14 days</span>
          <strong>Return window</strong>
          <p>Returns must be postmarked within fourteen days of the purchase date.</p>
        </article>
        <article>
          <span>Unused</span>
          <strong>Original condition</strong>
          <p>Returned items should be new, unused, and sent back with original tags, labels, and packaging.</p>
        </article>
        <article>
          <span>RMA</span>
          <strong>Email before sending</strong>
          <p>Email info@saltylamps.co.uk first so customer service can issue a return authorisation number.</p>
        </article>
      </div>
      <div className="policy-steps">
        <h2>How to return an item</h2>
        <ol>
          <li>Email customer service to request a Return Merchandise Authorization number.</li>
          <li>Place the item securely in its original packaging with proof of purchase.</li>
          <li>Mail the return to Salty Lamps Ltd, Unit 41, Imex Business Park, Ormonde Street, Stoke-on-Trent, ST4 3NP.</li>
          <li>Allow at least three days after receipt for the return or exchange to be processed.</li>
        </ol>
      </div>
      <div className="policy-note">
        <strong>Opened salt bags and pouches cannot be returned.</strong>
        <p>For defective or damaged products, contact Salty Lamps so the team can arrange a refund or exchange.</p>
      </div>
      <div className="hero-actions">
        <a className="button primary" href="mailto:info@saltylamps.co.uk?subject=Return%20or%20exchange%20request">Start a return</a>
        <a className="button secondary" href="tel:+441782970001">Call 01782 970001</a>
      </div>
    </section>
  )

  const renderProcessPage = () => (
    <section className="process-page">
      <div className="process-hero">
        <div className="process-hero-copy">
          <p className="eyebrow">How it is made</p>
          <h1>From mined rock salt to finished lamps, bricks, bowls, and tiles.</h1>
          <p>
            The Salty Lamps manufacturing route follows the material from mine extraction through sorting, cutting, hand-finishing, packaging, palletizing, and export.
          </p>
        </div>
        <div className="process-visual" aria-label="Manufacturing process visual">
          {processSteps.map((step, index) => (
            <span key={step.title}>
              <strong>{index + 1}</strong>
              {step.label}
            </span>
          ))}
        </div>
      </div>
      <div className="process-film" aria-label="Manufacturing process video">
        {processFilmPlaying ? (
          <video
            playsInline
            autoPlay
            controls
            preload="metadata"
            onEnded={() => setProcessFilmPlaying(false)}
            poster="/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg"
          >
            <source src="/media/video/salty-lamps-manufacturing-process-16x9.mp4" type="video/mp4" />
          </video>
        ) : processFilmPosterFailed ? (
          <button
            type="button"
            className="video-facade video-facade--fallback"
            onClick={() => setProcessFilmPlaying(true)}
            aria-label="Play the Salty Lamps manufacturing process film"
          >
            <span className="video-facade__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="video-facade"
            onClick={() => setProcessFilmPlaying(true)}
            aria-label="Play the Salty Lamps manufacturing process film"
          >
            <img
              className="video-facade__poster"
              src="/media/video/salty-lamps-manufacturing-process-poster-16x9.jpg"
              alt=""
              loading="eager"
              onError={() => setProcessFilmPosterFailed(true)}
            />
            <span className="video-facade__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.78-6.86a1 1 0 0 0 0-1.69L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="process-about" aria-label="About Salty Lamps products">
        <div className="process-about-copy">
          <p className="eyebrow">About Salty Lamps</p>
          <h2>One natural material, shaped for homes, kitchens, spas, trade buyers, and animals.</h2>
          <p>
            Salty Lamps Ltd manufactures high-quality Himalayan crystal rock salt products with care, from raw material selection through shaping, finishing, packing, and supply. The range is broad, but the promise stays simple: natural salt products that feel warm, useful, sustainable, and made with attention.
          </p>
        </div>
        <div className="process-range-grid">
          {processProductRanges.map(item => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="process-proof" aria-label="What the manufacturing film shows">
        {processProofPoints.map(point => (
          <article key={point.title}>
            <span>{point.stat}</span>
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </article>
        ))}
      </div>
    </section>
  )

  const renderReviewsPage = () => (
    <section className="reviews-page">
      <header className="reviews-page-hero">
        <div>
          <p className="eyebrow">Guestbook feedback</p>
          <h1>Real customer notes from the Salty Lamps guestbook.</h1>
          <p>Every note is left by a verified buyer through the post-purchase guestbook. Start with the strongest themes, then browse a representative set of real customer wording.</p>
        </div>
        <div className="reviews-page-score">
          <strong>5.0</strong>
          <span className="review-stars" aria-hidden="true">★★★★★</span>
          <small>{reviews.length} verified reviews</small>
        </div>
      </header>
      <div className="review-theme-grid" aria-label="Customer review themes">
        {reviewSignals.map(signal => (
          <article key={signal.label}>
            <span>{signal.count}</span>
            <strong>{signal.label}</strong>
            <p>{signal.percent}% of guestbook notes mention this theme.</p>
          </article>
        ))}
      </div>
      <div className="review-feature-grid" aria-label="Featured customer proof">
        {featuredReviews.map(review => (
          <article key={`${review.name}-${review.date}`}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
              <span>
                <strong>{review.name}</strong>
                <small>{review.date}</small>
              </span>
            </div>
            <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
            <p>{review.quote}</p>
            <em>{review.proof}</em>
          </article>
        ))}
      </div>
      <div className="reviews-list-heading">
        <div>
          <p className="eyebrow">Representative guestbook notes</p>
          <h2>Recent proof without the endless scroll.</h2>
        </div>
        <p>Showing {Math.min(36, displayableReviews.length)} of {reviews.length} verified notes. The full archive can stay available behind a “load more” control when the live site needs it.</p>
      </div>
      <div className="reviews-grid">
        {displayableReviews.slice(0, 36).map(review => (
          <article key={review.id}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">{initialsFor(review.name)}</span>
              <span>
                <strong>{review.name}</strong>
                <small>{review.date}</small>
              </span>
            </div>
            <p className="review-stars-line" aria-label="5 star review">★★★★★</p>
            <p>{review.feedback}</p>
            <em>Verified buyer</em>
          </article>
        ))}
      </div>
    </section>
  )

  const renderCheckoutSuccess = () => (
    <section className="policy-page checkout-status-page">
      <p className="eyebrow">Order confirmed</p>
      <h1>Thank you — your order is confirmed.</h1>
      <p>
        Payment was successful and a confirmation email is on its way. Salty Lamps will get your order packed and shipped shortly.
      </p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Continue shopping</Link>
        <a className="button secondary" href="mailto:info@saltylamps.co.uk">Contact us about this order</a>
      </div>
    </section>
  )

  const renderCheckoutCancelled = () => (
    <section className="policy-page checkout-status-page">
      <p className="eyebrow">Checkout cancelled</p>
      <h1>Your order was not placed.</h1>
      <p>
        No payment was taken. Your cart is still here if you would like to try again.
      </p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Return to shop</Link>
        <a className="button secondary" href="mailto:info@saltylamps.co.uk">Contact us</a>
      </div>
    </section>
  )

  const renderNotFound = () => (
    <section className="policy-page not-found-page">
      <p className="eyebrow">{pageCopy.notFound.eyebrow}</p>
      <h1>{pageCopy.notFound.title}</h1>
      <p>{pageCopy.notFound.description}</p>
      <div className="hero-actions">
        <Link className="button primary" href="/shop">Shop the range</Link>
        <Link className="button secondary" href="/">Return home</Link>
      </div>
    </section>
  )

  // The admin portal is a self-contained, auth-gated subtree with its own chrome
  // (sidebar + topbar) — render it instead of the storefront shell. Placed after
  // all hooks so React's rules-of-hooks hold.
  if (route.startsWith('/admin')) {
    return <AdminApp route={route} />
  }

  return (
    <div className="site-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="announce">Bulk and trade orders available</div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Salty Lamps home">
          <img src="/media/logo.png" alt="" />
          <span>Salty Lamps</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/gallery">Gallery</Link>
          <a href="/#trade">Trade</a>
          <Link href="/admin">Admin</Link>
          <a href="mailto:info@saltylamps.co.uk">Contact</a>
          <Link className="nav-about" href="/process">About</Link>
        </nav>
        <button className="cart-button" type="button" onClick={() => setCartOpen(true)}>
          Cart <span>{cartCount}</span>
        </button>
      </header>

      <main id="main">
        {notFound
          ? renderNotFound()
          : currentProduct
          ? renderProductPage(currentProduct)
          : route === '/checkout/success'
            ? renderCheckoutSuccess()
          : route === '/checkout/cancelled'
            ? renderCheckoutCancelled()
          : route === '/process'
            ? renderProcessPage()
            : route === '/reviews'
              ? renderReviewsPage()
              : route === '/returns-exchanges' || route === '/return-refund-policy'
                ? renderReturnPolicy()
          : page
            ? renderPolicy(page)
            : route === '/gallery'
              ? renderGallery()
              : route === '/shop' || categorySlug || activeShopperPath
                ? renderShop()
                : renderHome()}
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="footer-eyebrow">Primary manufacturer &amp; processor</span>
          <strong>Salty Lamps Ltd</strong>
          <ul className="footer-contact">
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Unit 41, Imex Business Park, Ormonde Street, Stoke-on-Trent, ST4 3NP</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
              <a href="mailto:info@saltylamps.co.uk">info@saltylamps.co.uk</a>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
              </svg>
              <a href="tel:+441782970001">01782 970001</a>
            </li>
          </ul>
        </div>
        <form
          className="newsletter"
          onSubmit={handleNewsletterSubmit}
        >
          <label>
            <span className="footer-eyebrow">Newsletter</span>
            <span className="newsletter-field">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
              <input name="email" type="email" placeholder="Email address" required />
            </span>
          </label>
          <button type="submit">Subscribe</button>
          {newsletterMessage && <span className="newsletter-message">{newsletterMessage}</span>}
        </form>
        <nav aria-label="Footer links">
          <span className="footer-eyebrow">Company</span>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link className="footer-link-accent" href="/return-refund-policy">Returns and Exchanges</Link>
          <Link href="/process">Manufacturing Process</Link>
        </nav>
      </footer>

      <ChatModule onSubmit={handleChatSubmit} message={chatMessage} />

      <aside
        className={`cart-drawer ${cartOpen ? 'open' : ''}`}
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        inert={cartOpen ? undefined : ''}
      >
        <header>
          <div>
            <p className="eyebrow">Your cart</p>
            <h2>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Ready when you are'}</h2>
          </div>
          <button type="button" onClick={() => setCartOpen(false)}>Close</button>
        </header>
        <div className="cart-lines">
          {cart.length ? cart.map(item => (
            <article className="cart-line" key={item.key}>
              <img src={item.product.image} alt="" />
              <div>
                <strong>{item.product.name}</strong>
                {Object.entries(item.options).map(([name, value]) => (
                  <span key={name}>{name}: {value}</span>
                ))}
                <small>{money(item.product.price)}</small>
              </div>
              <div className="qty">
                <button type="button" onClick={() => changeQty(item.key, -1)} aria-label={`Decrease ${item.product.name}`}>-</button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => changeQty(item.key, 1)} aria-label={`Increase ${item.product.name}`}>+</button>
              </div>
            </article>
          )) : <p>Your selected products will appear here.</p>}
        </div>
        <footer>
          {notice && <p className="notice">{notice}</p>}
          <span>Subtotal</span>
          <strong>{money(cartTotal)}</strong>
          {cart.length ? (
            <button
              type="button"
              className="button primary"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirecting…' : 'Checkout'}
            </button>
          ) : (
            <Link className="button secondary" href="/shop" onClick={() => setCartOpen(false)}>
              Continue shopping
            </Link>
          )}
        </footer>
      </aside>
      {cartOpen && <button className="scrim" type="button" aria-label="Close cart" onClick={() => setCartOpen(false)} />}

      {quickViewProduct && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="quick-view-title">
          <button className="scrim" type="button" aria-label="Close quick view" onClick={() => setQuickViewId(null)} />
          <div className="quick-view">
            <button className="close-button" type="button" onClick={() => setQuickViewId(null)}>Close</button>
            <img src={quickViewProduct.image} alt={quickViewProduct.name} />
            <div>
              <p className="eyebrow">{quickViewProduct.tags.join(' / ')}</p>
              <h2 id="quick-view-title">{quickViewProduct.name}</h2>
              <p>{quickViewProduct.description}</p>
              <strong>{priceLabel(quickViewProduct)}</strong>
              <OptionSelectors
                product={quickViewProduct}
                selected={selectedOptions[quickViewProduct.id] || {}}
                onSelect={(name, value) => selectOption(quickViewProduct.id, name, value)}
              />
              {notice && quickViewId === quickViewProduct.id && <p className="notice">{notice}</p>}
              <div className="hero-actions">
                <button className="button primary" type="button" onClick={() => addProduct(quickViewProduct, 'quick-view')} disabled={!quickViewProduct.stock || quickViewProduct.priceTBD}>
                  Add to cart
                </button>
                <Link className="button secondary" href={`/product-page/${quickViewProduct.slug}`} onClick={() => setQuickViewId(null)}>
                  Full details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
