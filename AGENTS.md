# Salty Lamps migration boundaries

Read `infra/account-ownership.md` and `salty-lamps-site/docs/migration.md` before any Cloudflare or Wix migration work.

- `Saltylamps@hotmail.com` is the approved owner of the Salty Lamps Cloudflare account and the only production account destination.
- `asifhussain60@gmail.com` is an Active member with an account-wide administrator policy **within that owner account**, verified in the signed-in dashboard. An empty EU-jurisdiction D1 database was created there; other write scopes remain unverified. Its separate personal account is not a production destination, and shop administrator Access remains unverified.
- `asifhussain60@hotmail.com` is retired and prohibited. Never use that Cloudflare account, its project, database, bucket, dashboard, tokens, saved credentials or related resources. Historical records may identify it only as provenance; they are not migration targets or launch backups.
- The owner account's displayed member list contained only owner and Gmail as Active. Check pending invitations separately; remove any invitation or membership for the retired identity if present, and never accept or test it.
- Keep the Wix business exports and rehearsal database separate from the replacement shop database. Do not import or merge them into production before the owner reviews both structures at migration checklist item 5.
- Keep the current Wix shop and Zoho mail running until the replacement passes the documented launch gates. Do not perform a live payment, launch, service cancellation or customer-data import without the required business authorization.
- Treat account authorization, provider connection, Cloudflare Access protection and successful local tests as distinct facts. Verify each one before marking it complete.
- If a backup or test hits a repeated blocker, stop that path and report the exact gap instead of looping.
