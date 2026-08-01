-- Migration 005 — Transactional email: templates, the send log, and enquiries.
--
-- IDEMPOTENT AND SAFE TO RE-RUN, like 003 and 004 and unlike 001. Every statement
-- is `CREATE TABLE IF NOT EXISTS` or `INSERT OR IGNORE`, because
-- deploy-production.sh loops over d1/migrations/*.sql on EVERY run.
--
-- Apply once to each existing database:
--   Local:  wrangler d1 execute salty-lamps-db --local  --file=d1/migrations/005-email.sql
--   Remote: wrangler d1 execute salty-lamps-db --remote --file=d1/migrations/005-email.sql
--
-- LOCAL GOTCHA (see 003's header): `--local` and `wrangler pages dev` can resolve
-- to DIFFERENT sqlite files. Verify through the running server, not --local alone.

-- --------------------------------------------------------------------------
-- Templates
-- --------------------------------------------------------------------------
-- WORDING ONLY. The layout, palette, logo, order table and Outlook-safe markup
-- live in functions/lib/email-render.mjs and are not editable, for the same reason
-- content_snippets holds strings while collection_sections holds structure: a copy
-- edit must never be able to break rendering in a customer's mail client.
--
-- The editable slots are deliberately few. Each maps to one block the renderer
-- already draws, so there is no slot that can be left blank and leave a hole:
--   subject    — the subject line
--   preheader  — the grey preview line mail clients show next to the subject
--   heading    — the large line inside the amber header band
--   intro      — the paragraph above the order/detail panel
--   cta_label  — the button caption (button is omitted entirely when blank)
--   outro      — the paragraph below the panel, above the footer
--
-- {{token}} placeholders are interpolated at send time. The permitted tokens are
-- whitelisted PER TEMPLATE in EMAIL_TEMPLATE_SPECS (functions/lib/validation.mjs)
-- and rejected at the write path, so a typo cannot ship an email reading
-- "undefined" to a customer.
CREATE TABLE IF NOT EXISTS email_templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'customer' CHECK (audience IN ('customer', 'admin')),
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  heading TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  outro TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------------------
-- Send log
-- --------------------------------------------------------------------------
-- There is no 'pending' status, on purpose. Sends are synchronous — fired after
-- the business transaction has already committed, in parallel, with a per-send
-- timeout — so every row lands on a true final outcome. An earlier design deferred
-- the send and would have left rows stuck at 'pending' whenever an isolate died,
-- with no scheduler in Pages Functions to ever resolve them.
--
-- 'skipped' means the send was suppressed by configuration (email_enabled off,
-- template disabled, no recipient address, or MAIL_DRY_RUN) rather than failing.
-- Distinguishing it from 'failed' is what stops a deliberately quiet UAT
-- environment from looking like an outage in the admin.
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  to_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  -- Nullable and NOT a foreign key: enquiry and low-stock emails have no order,
  -- and a send log must never be able to block or be blocked by an order write.
  order_id TEXT,
  provider_id TEXT,                  -- the sender's own message id, for support tickets
  payload TEXT,                      -- JSON of the render data, so Resend can replay a send
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON email_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_order ON email_outbox(order_id);

-- --------------------------------------------------------------------------
-- Enquiries
-- --------------------------------------------------------------------------
-- The chat widget, trade form and newsletter signup in src/App.jsx wrote to
-- Supabase, where nobody was notified and which is the last remaining second
-- backend in an app that has otherwise moved wholly to D1. They now write here and
-- notify the admin. Historical Supabase rows are left untouched in Supabase.
--
-- This table is read by the admin (Emails -> Enquiries). It is the record of
-- truth; the notification email is a convenience on top of it, so a bounced or
-- failed email can never lose a lead.
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'chat',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at DESC);

-- --------------------------------------------------------------------------
-- Settings
-- --------------------------------------------------------------------------
-- email_enabled seeds to '0'. Sending needs DKIM and SPF records on
-- saltylamps.co.uk that only the domain owner can add; until they exist every send
-- would fail, and a shop that quietly sends nothing is better than one writing a
-- failure row per order. Switch it on from admin Settings after a successful test.
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('email_enabled', '0', 'bool');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('email_from_name', 'Salty Lamps', 'string');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('email_from_address', 'orders@saltylamps.co.uk', 'string');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('admin_notify_email', 'info@saltylamps.co.uk', 'string');
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES ('low_stock_alerts_enabled', '1', 'bool');

-- --------------------------------------------------------------------------
-- Default wording
-- --------------------------------------------------------------------------
-- Seeded so the system works before anyone opens the editor. Every token used
-- below appears in that template's whitelist in validation.mjs.

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('order_confirmation', 'Order confirmation', 'customer',
   'Your Salty Lamps order {{order_ref}}',
   'Thank you — we have your order and payment.',
   'Thank you for your order',
   'Hello {{customer_name}}, thank you for shopping with Salty Lamps. We have received your payment and your order is now being prepared. Everything you ordered is listed below.',
   '',
   'Every piece is cut from natural Himalayan rock salt, so colour, texture and weight vary from one item to the next. If anything is not right when it arrives, reply to this email and we will put it straight.',
   10);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_new_order', 'New order alert (admin)', 'admin',
   'New order received ({{order_ref}}) — {{order_total}}',
   'A new order has been placed and paid for.',
   'New order received',
   'An order has been placed on saltylamps.co.uk and payment has cleared. The full details are below.',
   'Open in admin',
   '',
   20);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('order_shipped', 'Order despatched', 'customer',
   'Your Salty Lamps order {{order_ref}} is on its way',
   'Your parcel has left us.',
   'Your order is on its way',
   'Good news {{customer_name}} — your order has been packed and handed to the courier. It is heading to the address below.',
   '',
   'Salt is heavy and we pack it accordingly, so the parcel may feel more substantial than you expect. If it has not arrived within a week, reply to this email and we will chase it for you.',
   30);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('order_delivered', 'Order delivered', 'customer',
   'Your Salty Lamps order {{order_ref}} has been delivered',
   'Your order has been marked as delivered.',
   'Your order has arrived',
   'Hello {{customer_name}}, our records show your order has been delivered. We hope it is everything you hoped for.',
   '',
   'If anything arrived damaged or is not what you expected, reply to this email within 14 days and we will sort out a replacement or a refund.',
   40);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('order_refunded', 'Refund confirmed', 'customer',
   'Your Salty Lamps refund for order {{order_ref}}',
   'Your refund has been processed.',
   'Your refund is on its way',
   'Hello {{customer_name}}, we have refunded your order in full. The money goes back to the card or account you paid with.',
   '',
   'Refunds usually appear within five to ten working days, depending on your bank. If it has not landed after ten working days, reply to this email and we will look into it.',
   50);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('order_cancelled', 'Order cancelled', 'customer',
   'Your Salty Lamps order {{order_ref}} has been cancelled',
   'This order has been cancelled.',
   'Your order has been cancelled',
   'Hello {{customer_name}}, your order has been cancelled and will not be despatched. If you were charged, the payment has been released back to you.',
   '',
   'If this was not what you expected, reply to this email and we will help put it right.',
   60);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_refund_request', 'Refund request (admin)', 'admin',
   'Refund request for order {{order_ref}}',
   'A customer has asked to return or refund an order.',
   'Refund request',
   'A customer has requested a refund or return through the website. Their order has been matched and verified before this email was sent.',
   'Open in admin',
   '',
   70);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_enquiry_chat', 'Chat message (admin)', 'admin',
   'New chat message from {{name}}',
   'Someone has sent a message through the website chat.',
   'New chat message',
   'A visitor sent this through the chat panel on the website. Reply to this email to answer them directly.',
   '',
   '',
   80);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_enquiry_trade', 'Trade enquiry (admin)', 'admin',
   'New trade enquiry from {{name}}',
   'A wholesale or trade enquiry has come in.',
   'New trade enquiry',
   'A trade or wholesale enquiry was submitted on the website. Reply to this email to answer them directly.',
   '',
   '',
   90);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_enquiry_newsletter', 'Newsletter signup (admin)', 'admin',
   'New newsletter signup: {{email}}',
   'Someone has subscribed to the newsletter.',
   'New newsletter signup',
   'Someone subscribed to the Salty Lamps newsletter from the website footer.',
   '',
   '',
   100);

INSERT OR IGNORE INTO email_templates (key, label, audience, subject, preheader, heading, intro, cta_label, outro, sort_order) VALUES
  ('admin_low_stock', 'Low stock alert (admin)', 'admin',
   'Low stock: {{product_name}}',
   'An item has dropped below the low-stock threshold.',
   'Low stock',
   'A sale has taken this item below the low-stock threshold set in admin Settings. This alert fires once, at the moment it crosses — not on every subsequent order.',
   'Open inventory',
   '',
   110);

-- --------------------------------------------------------------------------
-- Added 2026-08-01 — the address the SHOP PUBLISHES, split from the address
-- ADMIN ALERTS ARE SENT TO.
-- --------------------------------------------------------------------------
-- These were one setting (`admin_notify_email`), read both by the mailer and by
-- /api/content for the storefront's contact links and its schema.org Store block.
-- Pointing alerts at a personal mailbox to test them therefore published that
-- personal address on a crawlable website — which is exactly what happened.
--
-- Seeded from whatever `admin_notify_email` holds at migration time so an existing
-- database keeps rendering the address it already showed, then COALESCEd to the
-- shop address so a database whose alerts had already been repointed does not
-- inherit the personal one.
INSERT OR IGNORE INTO settings (key, value, value_type)
SELECT
  'public_contact_email',
  COALESCE(
    (SELECT value FROM settings
      WHERE key = 'admin_notify_email'
        AND value LIKE '%@saltylamps.co.uk'),
    'info@saltylamps.co.uk'
  ),
  'string';
