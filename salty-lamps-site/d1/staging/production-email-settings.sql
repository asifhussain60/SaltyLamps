-- Owner-approved recipient routing, 26 September 2026.
-- Staged separately from automatic migrations. Apply only to the reviewed owner
-- shop database after its schema/catalogue gate; never to the Wix archive.
-- No credentials here. Sending stays off until the owner Resend domain, secret,
-- actual inbox delivery and launch readiness have been verified.
INSERT INTO settings (key, value, value_type) VALUES
  ('admin_notify_email', 'Saltylamps@hotmail.com', 'string'),
  ('email_from_name', 'Salty Lamps', 'string'),
  ('email_from_address', 'orders@saltylamps.co.uk', 'string'),
  ('public_contact_email', 'info@saltylamps.co.uk', 'string'),
  ('site_url', 'https://www.saltylamps.co.uk', 'string'),
  ('email_enabled', '0', 'bool')
ON CONFLICT(key) DO UPDATE SET value=excluded.value, value_type=excluded.value_type;
