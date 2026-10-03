# Private website feedback

Requested by Asif on 3 October 2026, attributed to Asim. Published only through the isolated development release workflow; production requires separate acceptance and sign-off.

- `/feedback` is linked from the storefront navigation and the owner welcome page. Navigation carries only the current path, excluding query strings and fragments.
- Visitors supply an email, feedback type and message, with optional name and page path. The form explains privacy, preserves input after failure and returns a saved reference.
- `/api/support/feedback` stores `source=feedback` in the existing enquiries table. No schema migration or data import is required. Exact retries within ten minutes return the original reference; five distinct submissions per sender per ten minutes are permitted. Same-origin checks, a honeypot, bounded fields and escaped email rendering cover basic misuse. These are basic abuse controls, not a replacement for edge rate limiting on a future public release.
- `admin_feedback` has a built-in mail template, using the existing mailer, configured administrator recipient and sender Reply-To. The existing outbox captures notification payload and outcome. Failed notifications do not remove the saved feedback; the administrator can retry from Activity. A built-in template avoids changing either environment's template rows.
- `/admin/emails?tab=feedback` provides a private, paginated feedback view. The test shop keeps MAIL_DRY_RUN and has no sending key. Captured notifications are not inbox delivery evidence.

## Verification

Focused tests cover persistence, capture, Reply-To, escaped input, provider failure, duplicate retries, malformed input, cross-origin requests, honeypot handling, throttling and save failure. The guarded release additionally runs all unit and environment-preflight checks and the production build. Desktop and phone form layout were inspected in the browser. Hosted submission and administrator checks are recorded below when publication completes.

Design follows the existing cream/amber palette, balanced card borders, and the local style catalog's lightweight form focus treatment. No archive runtime dependency was introduced.

Hosted verification on 3 October 2026: Cloudflare sign-in succeeded; the new navigation opened the form with its referring path; a clearly labelled artificial submission returned reference #2; the protected Feedback tab showed the same message; Activity showed `admin_feedback` addressed to the configured shop inbox with `skipped` because sending is off. No real email was sent. All 280 unit checks and 15 preflight checks passed. A local transport-failure rehearsal preserved the form text and led to a plain-language retry-message improvement. The exact hosted commit and private development backup are recorded by `publish.sh` in the private release receipt.
