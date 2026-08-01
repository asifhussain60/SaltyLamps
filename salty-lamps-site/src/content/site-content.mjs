// Site content extracted verbatim from src/App.jsx.
//
// A real ES module, imported by BOTH the storefront (src/App.jsx) and the build-time
// snapshot script (scripts/fetch-content-snapshot.mjs) — the same share pattern as
// functions/lib/flatten-products.mjs and functions/lib/validation.mjs.
//
// This replaces scripts/generate-seo.mjs's old text-scraping of App.jsx source
// (indexOf + Function() eval), which broke the build if a const was renamed,
// reordered, or referenced anything other than img/media.
//
// MUST stay pure data: no JSX, no React, no Worker APIs, no DOM APIs.
//
// These consts move into D1 in later stages (categories/groupThemes/categoryAliases
// first, then shopperPaths and pages); this module is the staging post that makes
// that move safe.

export const img = name => `/media/live-site-products/${name}`
export const media = name => `/media/${name}`

export const groupThemes = {
  'salt-lamps': 'lamp',
  'candle-holders': 'holder',
  'rock-salt-pantry-items': 'kitchen',
  'rock-salt-bricks': 'bricks',
  'equestrian-salt-licks': 'equestrian',
  'himalayan-salt-massage-relaxation-products': 'relaxation',
  accessories: 'accessory',
  'special-deal': 'deal',
  'salt-wall-panels': 'panel',
}

export const siteUrl = 'https://www.saltylamps.co.uk'
export const categoryAliases = {
  'himalyan-salt-massage-relaxation-products': 'himalayan-salt-massage-relaxation-products',
}

export const categories = [
  {
    slug: 'all-products',
    name: 'All products',
    description: 'The full Salty Lamps range in one place.',
    image: img('lamp-sphere-gemini.jpg'),
  },
  {
    slug: 'salt-lamps',
    name: 'Salt lamps',
    description: 'Warm-glow lamps for bedrooms, counters, lounges, and gifts.',
    image: img('lamp-block-gemini.jpg'),
  },
  {
    slug: 'candle-holders',
    name: 'Candle holders',
    description: 'Giftable tealight holders for cosy rooms, spas, and tables.',
    image: img('holder-natural-gemini.jpg'),
  },
  {
    slug: 'rock-salt-pantry-items',
    name: 'Kitchen saltware',
    description: 'Platters, bowls, culinary salt, and salt barware.',
    image: img('salty-chef-family-live-site.png'),
  },
  {
    slug: 'rock-salt-bricks',
    name: 'Salt bricks',
    description: 'Salt wall bricks and feature-wall materials for trade buyers.',
    image: img('salt-bricks-clean-gemini.jpg'),
  },
  {
    slug: 'equestrian-salt-licks',
    name: 'Equestrian salt licks',
    description: 'Mineral salt licks for horses, cattle, fields, and yards.',
    image: img('lick-field-scene-gemini.jpg'),
  },
  {
    slug: 'himalayan-salt-massage-relaxation-products',
    name: 'Massage and relaxation',
    description: 'Spa, bath, massage, and body-care salt products.',
    image: img('massage-stones-gemini.jpg'),
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    description: 'Replacement bulbs and cables for compatible salt lamps.',
    image: img('accessory-bulb-gemini.jpg'),
  },
  {
    slug: 'special-deal',
    name: 'Special deals',
    description: 'Bundle offers and starter sets for easy gifting.',
    image: img('holder-apple-gemini.jpg'),
  },
  {
    slug: 'salt-wall-panels',
    name: 'Aura Collection',
    description: 'Illuminated Himalayan salt wall art in hand-finished wood frames.',
    image: img('aura-collection-frame-detail-live-site.jpg'),
  },
]

export const shopperPaths = [
  {
    slug: 'home-gifts',
    name: 'Home, gifts and glow',
    shortName: 'Home and gifts',
    eyebrow: 'Everyday warmth',
    heading: 'Lamps, holders, gifts, and easy home glow.',
    description: 'Warm-room products for bedrooms, desks, lounges, shelves, and simple gifting.',
    heroIntro: [
      "There's a particular kind of calm that arrives when a room glows amber instead of glaring white. Our hand-finished ",
      { hl: 'salt lamps and candle holders' },
      " turn bedrooms, desks, and lounges into spaces that feel warmer the moment they're lit — and they make ",
      { hl: 'quietly thoughtful gifts' },
      '. Every piece is carved from natural Himalayan rock salt, so ',
      { hl: 'no two are ever quite alike' },
      '.',
    ],
    heroVideo: media('video/collection/home-gifts-hero-16x9.mp4'),
    heroPoster: media('video/collection/home-gifts-hero-poster-16x9.jpg'),
    categories: ['special-deal', 'salt-lamps', 'candle-holders', 'accessories'],
    theme: 'lamp',
    background: media('yoga-room.png'),
    foreground: [img('lamp-sphere-gemini.jpg'), img('holder-heart-gemini.jpg')],
  },
  {
    slug: 'kitchen-food',
    name: 'Kitchen and food',
    shortName: 'Kitchen',
    eyebrow: 'Cooking and serving',
    heading: 'Saltware, platters, bowls, and pantry salt.',
    description: 'Food and hosting products for kitchens, counters, table settings, and gifts.',
    heroIntro: [
      'Salt should be something you can see, taste, and serve from. Our ',
      { hl: 'culinary-grade Himalayan salt' },
      ', hand-cut platters, and serving bowls bring ',
      { hl: 'genuine mineral character' },
      ' to everyday cooking and unhurried hosting alike. Sear, chill, plate, and present on a material that is ',
      { hl: 'as striking on the table as in the pan' },
      '.',
    ],
    heroVideo: media('video/collection/kitchen-food-hero-16x9.mp4'),
    heroPoster: media('video/collection/kitchen-food-hero-poster-16x9.jpg'),
    categories: ['rock-salt-pantry-items'],
    theme: 'kitchen',
    background: media('kitchen-setup.png'),
    foreground: [img('salty-chef-family-live-site.png'), img('platter-kitchen-gemini.jpg')],
  },
  {
    slug: 'horses-farm',
    name: 'Horses and farm',
    shortName: 'Horses and farm',
    eyebrow: 'Field and yard supply',
    heading: 'Salt licks and bulk-ready animal mineral products.',
    description: 'Simple routes for horse owners, yards, smallholders, and equestrian suppliers.',
    heroIntro: [
      'Animals know what they need. A ',
      { hl: 'natural Himalayan salt lick' },
      ' gives horses, ponies, and cattle a simple mineral source they can return to in the field or yard — ',
      { hl: 'no fuss, no additives' },
      ', just natural rock salt for everyday routines. Single licks or bulk-ready supply for busy yards.',
    ],
    heroVideo: media('video/collection/horses-farm-hero-16x9.mp4'),
    heroPoster: media('video/collection/horses-farm-hero-poster-16x9.jpg'),
    categories: ['equestrian-salt-licks'],
    theme: 'equestrian',
    background: media('home-horse-salt-lick-generated.png'),
    foreground: [img('lick-product-clean-gemini.jpg')],
  },
  {
    slug: 'trade-spa',
    name: 'Trade supply',
    shortName: 'Trade and wellness',
    eyebrow: 'Projects and repeat supply',
    heading: 'Salt walls, spa products, and trade-friendly ranges.',
    description: 'Bulk supply for spas, retailers, and interiors projects.',
    heroIntro: [
      'Wellness spaces sell a feeling before they sell anything else. ',
      { hl: 'Backlit salt-brick walls' },
      ', warm massage stones, and mineral bath salts let spas, treatment rooms, and interiors projects build that ',
      { hl: 'sense of calm' },
      ' into the room itself. ',
      { hl: 'Trade-friendly pricing and repeat supply' },
      ' make it easy to specify once and reorder with confidence.',
    ],
    heroVideo: media('video/collection/trade-spa-hero-16x9.mp4'),
    heroPoster: media('video/collection/trade-spa-hero-poster-16x9.jpg'),
    categories: ['rock-salt-bricks', 'himalayan-salt-massage-relaxation-products'],
    theme: 'bricks',
    background: media('home-spa-salt-room-generated.png'),
    foreground: [img('salt-bricks-clean-gemini.jpg'), img('massage-stones-gemini.jpg')],
  },
  {
    slug: 'aura-collection',
    name: 'The Aura Collection',
    shortName: 'Aura Collection',
    eyebrow: 'Illuminated wall art',
    heading: 'Illuminated Himalayan salt wall art, framed by hand.',
    description: 'Luxury backlit salt panels in hand-finished wood frames — warm, unique wall art for homes, gyms, and studios.',
    heroIntro: [
      'The Aura Collection is ',
      { hl: 'illuminated Himalayan salt wall art' },
      ' — carved from ancient rock salt formed over millions of years, so ',
      { hl: 'every panel is unique' },
      ', with natural mineral veining from pale pink to deep orange. Each piece is set in a ',
      { hl: 'hand-finished solid-wood frame' },
      ' with mitred corners, pairs beautifully with wood, stone, linen, and plants, and comes in a range of sizes — from a single accent panel to a full statement wall, at home, in the studio, or in reception.',
    ],
    heroVideo: media('video/collection/aura-collection-hero-16x9.mp4'),
    heroPoster: media('video/collection/aura-collection-hero-poster-16x9.jpg'),
    categories: ['salt-wall-panels'],
    theme: 'panel',
    background: media('aura-collection-lifestyle.jpg'),
    foreground: [img('aura-collection-frame-detail-live-site.jpg'), img('aura-collection-workshop-real-live-site.jpg')],
  },
]

export const pages = {
  '/privacy-policy': {
    title: 'Privacy Policy',
    body: [
      'Salty Lamps Ltd only collects the information needed to answer enquiries, process orders, and send requested updates.',
      'Newsletter subscribers can opt out of marketing emails at any time by contacting info@saltylamps.co.uk.',
      'Customer details are handled carefully and are not sold to third parties.',
    ],
  },
  '/terms-and-conditions': {
    title: 'Terms and Conditions',
    body: [
      'Orders are subject to product availability, confirmed pricing, and successful payment or agreed invoice terms.',
      'Natural Himalayan salt products vary in tone, texture, and shape because every piece is cut from natural rock salt.',
      'Use products according to the care guidance supplied and keep salt items away from excess moisture.',
    ],
  },
  '/return-refund-policy': {
    title: 'Returns and Refund Policy',
    body: [
      'If an item arrives damaged or incorrect, contact Salty Lamps Ltd promptly with your order details and photographs where relevant.',
      'Returns and exchanges are reviewed against product condition, timing, and the nature of the item ordered.',
      'Trade, custom, and bulk orders may require separate return arrangements.',
    ],
  },
}
