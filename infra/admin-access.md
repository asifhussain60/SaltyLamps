# Salty Lamps administrator access

The administrator address is `https://admin.saltylamps.co.uk/admin`. This is a future production requirement; the replacement shop has not launched. The Admin menu points there, but public DNS and live Cloudflare Access protection are not yet verified.

Use the [approved Salty Lamps owner account](account-ownership.md), held by `Saltylamps@hotmail.com`. `asifhussain60@gmail.com` is an Active member with an account-wide administrator policy in that account. This membership does not itself grant entry to the future shop administrator hostname. The retired `asifhussain60@hotmail.com` Cloudflare account, its proposal hostname and its saved credentials must never be used for access setup or testing.

The owner dashboard now reports **Zero Trust Free active**. Its only listed identity provider is **Cloudflare**, under the team name `steep-voice-d86f`. No protected application or admission policy was saved. On two attempts, choosing the exact **Emails** selector in the new application policy form crashed the dashboard with `Maximum call stack size exceeded`; stop this browser route until the error is resolved or a reviewed alternative is ready. Neither attempt reached the Save policy or Create application action.

Before importing customer records or deploying an administrator interface, configure Cloudflare Access on the **entire admin hostname** with **Sign in with Cloudflare**, limited to the owner and `asifhussain60@gmail.com` only. Account membership and shop Access admission are separate checks. Test a signed-out direct admin page, a signed-out admin API request, an approved user, and a revoked or unapproved user. The public shop hostname must not serve admin pages or APIs. Keep development bypasses local only and never enable them on a deployed host.

The code's local denial tests pass, but these live checks remain open. The current [migration plan](../salty-lamps-site/docs/migration.md) is the release gate and records the result when completed. No one should send passwords, one-time codes or API secrets in chat.

Continuation decision, 26 September 2026: Asif independently reproduced the exact Emails-selector crash and instructed that this form be deferred. No form retry was made during the continuation. Keep the administrator site classified as unprotected. A narrowly scoped API alternative may be prepared for a separate review later; it is not approved or executed by this deferral. Continue independent local backup, recovery, reconciliation and read-only account checks.
