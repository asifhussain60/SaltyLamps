// Sample data for the admin preview and the "send test to me" button.
//
// Shared by both so the owner previews and tests through the SAME renderer and the
// SAME block assembly the live hooks use. A preview drawn by a second code path
// would be a picture of the wrong thing — which is also why there is no client-side
// copy of the renderer in AdminApp.jsx.
//
// The order is invented but shaped exactly like a real row from `orders`, so a
// change to orderBlocks() shows up in the preview immediately rather than being
// discovered by a customer.
import { orderTokens, orderBlocks } from './mailer.mjs'

const SAMPLE_ORDER = {
  id: 'cs_test_a1b2c3d4e5f6g7h8SAMPLE01',
  status: 'paid',
  fulfilment_status: 'shipped',
  customer_email: 'jane.doe@example.com',
  amount_total_pence: 4597,
  created_at: '2026-08-01 18:16:49',
  tracking_number: 'RM123456789GB',
  carrier: 'royal_mail',
  carrier_name: 'Royal Mail',
  tracking_url: 'https://www.royalmail.com/track-your-item#/tracking-results/RM123456789GB',
  ship_name: 'Jane Doe',
  ship_line1: '12 Fairmile Court',
  ship_line2: '25 Fairmile Road',
  ship_city: 'Christchurch',
  ship_postcode: 'BH23 2LA',
  ship_country: 'GB',
}

const SAMPLE_ITEMS = [
  { name: 'Himalayan Rock Salt Bowl', variant_label: '8" Dia', sku: 'SB-04', quantity: 1, unit_price_pence: 1999 },
  { name: 'Cable for Salt Lamp', variant_label: '', sku: 'PC2', quantity: 2, unit_price_pence: 599 },
  { name: 'Angel Shape Himalayan Rock Salt Lamp', variant_label: '', sku: 'RSL-A', quantity: 1, unit_price_pence: 1400 },
]

const SAMPLE_ENQUIRY = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  message: 'Hello — do you supply salt bricks in pallet quantities for a spa build?\n\nWe would need roughly 400 bricks delivered to Manchester in September.',
}

export function sampleFor(key) {
  const orderData = orderTokens(SAMPLE_ORDER, { paymentMethod: 'Card' })
  const orderPanels = orderBlocks(SAMPLE_ORDER, SAMPLE_ITEMS)

  if (key === 'admin_new_order' || key === 'admin_refund_request') {
    return {
      data: {
        ...orderData,
        reason: 'One of the candle holders arrived cracked at the base. Happy to send a photo.',
        ctaHref: '#',
      },
      blocks: [
        key === 'admin_refund_request'
          ? { type: 'note', title: 'What the customer said', text: 'One of the candle holders arrived cracked at the base. Happy to send a photo.' }
          : {
              type: 'panel',
              title: 'Customer',
              rows: [
                ['Name', SAMPLE_ORDER.ship_name],
                ['Email', SAMPLE_ORDER.customer_email],
                ['Payment method', 'Card'],
                ['Stripe reference', SAMPLE_ORDER.id],
              ],
            },
        ...orderPanels,
      ],
    }
  }

  if (key.startsWith('admin_enquiry_')) {
    return {
      data: SAMPLE_ENQUIRY,
      blocks: [
        {
          type: 'panel',
          title: 'From',
          rows: [['Name', SAMPLE_ENQUIRY.name], ['Email', SAMPLE_ENQUIRY.email], ['Came from', 'Website chat']],
        },
        { type: 'note', title: 'Message', text: SAMPLE_ENQUIRY.message },
      ],
    }
  }

  if (key === 'admin_low_stock') {
    return {
      data: {
        product_name: 'Himalayan Rock Salt Bowl',
        sku: 'SB-04',
        variant_label: '8" Dia',
        quantity: '4',
        threshold: '5',
        ctaHref: '#',
      },
      blocks: [{
        type: 'panel',
        title: 'Stock',
        rows: [
          ['Product', 'Himalayan Rock Salt Bowl'],
          ['Variant', '8" Dia'],
          ['SKU', 'SB-04'],
          ['Remaining', '4'],
          ['Threshold', '5'],
        ],
      }],
    }
  }

  // The despatch email is the one customer template with a button. renderEmail()
  // draws it only when the template has a cta_label AND the message supplies a
  // ctaHref, so without this the owner would preview — and test-send themselves —
  // an order_shipped with no Track button, then wonder where it went in the real
  // one. That is exactly the "picture of the wrong thing" this file exists to stop.
  if (key === 'order_shipped') {
    return { data: { ...orderData, ctaHref: SAMPLE_ORDER.tracking_url }, blocks: orderPanels }
  }

  return { data: orderData, blocks: orderPanels }
}
