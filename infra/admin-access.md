# Getting into the admin on the test site

The admin API is closed. Every request to it answers *"Admin authentication is not
configured"* — including yours. That is deliberate and it is the correct state: the
alternative, which is what it was doing until 2 August 2026, is answering everybody.

This is what it takes to open it again for the right people.

## What was wrong

A switch called `DEV_ADMIN_BYPASS` exists so a laptop can exercise the admin without
signing in. It had been set as a **production** secret on the test site and left
there, and the gate trusted it wherever it found it. With it set, every admin
endpoint answered anyone who asked — the whole catalogue, the whole order list, and
the routes that delete a product, delete a variant and issue a refund.

Two things changed on 2 August 2026:

1. **The gate no longer trusts the switch on its own.** It now also requires the
   request to have arrived at a local address. Cloudflare routes to a Pages project
   by hostname, so a deployed copy never sees one — the switch is inert anywhere but
   a laptop, whether or not anyone remembers to unset it.
2. **The production secret was deleted** and the project redeployed.

Verified afterwards: fourteen admin endpoints, three rounds, forty-two anonymous
requests, nothing answered with data. Delete and refund included. The shop,
checkout, category pages and product pages were unaffected throughout.

## Why the admin is shut rather than asking you to sign in

Cloudflare Access was never set up on this project. There is no sign-in page to
send you to — `/admin` was reachable only because the bypass was answering for it.
So the gate does the only safe thing available and refuses everyone.

## Restoring access — about fifteen minutes, and it needs your login

Do this in the Cloudflare dashboard on the account that owns the Pages project
(the hotmail one, `Asifhussain60@hotmail.com`).

1. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
2. Give it a name (`Salty Lamps admin` does fine) and add these two paths on the
   test-site hostname `salty-lamps-proposal.pages.dev`:
   - `/admin*`
   - `/api/admin*`
   Add the same two on the real domain when the shop moves there.
3. **Add a policy**: action *Allow*, rule *Emails* → your address, plus anyone else
   who should get in. Keep it to named addresses; do not use a whole-domain rule.
4. Save, then open the application's **Overview** tab and copy the **Application
   Audience (AUD) Tag**. Note your **team domain** too — the first part of
   `<team>.cloudflareaccess.com`, shown under Zero Trust → Settings → Custom Pages,
   or in the URL of your Zero Trust dashboard.
5. Set both as Pages secrets and redeploy:

```bash
cd ~/PROJECTS/SaltyLamps/salty-lamps-site && npx wrangler pages secret put ACCESS_AUD --project-name salty-lamps-proposal
```

```bash
cd ~/PROJECTS/SaltyLamps/salty-lamps-site && npx wrangler pages secret put ACCESS_TEAM_DOMAIN --project-name salty-lamps-proposal
```

```bash
cd ~/PROJECTS/SaltyLamps/salty-lamps-site && ./deploy-cloudflare.sh
```

6. **Check it.** Open the test site's admin in a browser — you should be sent to a
   Cloudflare sign-in page, and land in the admin after signing in. Then confirm a
   request carrying no session is still refused:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://salty-lamps-proposal.pages.dev/api/admin/orders
```

That must print `401`, not `200`. Once Access is configured the message changes from
"not configured" to "Not signed in", which is how you know step 5 took effect.

## Two things to keep in mind

- **`DEV_ADMIN_BYPASS` stays in `.dev.vars` and only there.** It is what lets the
  local dev server, the catalogue import tool and the reset tool work without a
  token. It is now harmless if it escapes, but there is still no reason to set it
  anywhere but a laptop.
- **Admin responses must never be cached.** The gate stamps every one of them
  `no-store`. During the checks above, one endpoint briefly returned a stale
  edge-cached copy after the fix had already landed — an empty order list, so
  nothing was disclosed, and it cleared on its own. If you ever change how admin
  responses are built, leave that header alone: it is the only thing stopping
  Cloudflare from replaying an authorised answer to a stranger.
