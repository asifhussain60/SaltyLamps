// Migration — the go-live walkthrough.
//
// WHO THIS IS WRITTEN FOR. Someone who runs a shop, not someone who writes
// software. Every phase says what it achieves in plain words before it says
// what to click, every command is provided ready to paste rather than
// described, and anything irreversible is flagged before the step, not after.
//
// ORDER IS THE POINT. The phases are arranged so that nothing customer-facing
// breaks until the very last moment, and so that each phase is provable before
// the next one depends on it. Reordering them reintroduces exactly the failures
// the order exists to prevent — in particular, moving the domain BEFORE the new
// shop is proven would take the old shop down with nothing ready to replace it.
//
// Ticks persist in the browser (see Checklist in docParts.jsx). The `id` on each
// Check is part of that stored state: renaming one silently un-ticks it for
// anyone mid-migration.
import React from 'react'
import { Callout, Check, CheckList, Checklist, ChecklistReset, Console, Ext, Phase } from './docParts.jsx'

// Every Check id, grouped by phase, so each phase header can count its own
// progress without the ids being written out twice.
const IDS = {
  p0: ['p0-owner', 'p0-registrar', 'p0-wix', 'p0-mailbox', 'p0-catalogue'],
  p1: ['p1-account', 'p1-r2', 'p1-accountid', 'p1-token', 'p1-keychain'],
  p2: ['p2-before', 'p2-addzone', 'p2-checkdns', 'p2-pointing', 'p2-ns', 'p2-verify'],
  p3: ['p3-enable', 'p3-destination', 'p3-rules', 'p3-test', 'p3-zoho'],
  p4: ['p4-account', 'p4-domain', 'p4-records', 'p4-spf', 'p4-verify', 'p4-settings'],
  p5: ['p5-firstrun', 'p5-dbid', 'p5-deploy', 'p5-check', 'p5-orders'],
  p6: ['p6-account', 'p6-keys', 'p6-webhook', 'p6-secrets', 'p6-testorder'],
  p7: ['p7-domain', 'p7-siteurl', 'p7-webhook', 'p7-redeploy', 'p7-redirects', 'p7-live'],
  p8: ['p8-gsc', 'p8-sitemap', 'p8-bing', 'p8-business'],
  p9: ['p9-export', 'p9-monitor', 'p9-wix', 'p9-zoho'],
}

export default function MigrationDoc() {
  return (
    <article className="admin-doc">
      <p className="admin-doc__lead">
        Everything needed to take Salty Lamps live on <strong>saltylamps.co.uk</strong>, in the
        order it has to happen. Work through one phase at a time and tick each step as you go —
        your progress is saved in this browser, so you can stop and come back.
      </p>

      <Callout tone="ok" title="The old shop stays up until the very last moment">
        Phases 1 to 7 build the new shop quietly alongside the existing one. Nothing your
        customers can see changes until <strong>Phase 8</strong>. Up to that point every single
        step can be undone.
      </Callout>

      <Callout tone="warn" title="Two things that are easy to break, and hard to un-break">
        <p style={{ margin: '4px 0' }}>
          <strong>Email.</strong> The mailbox on this domain works because of a handful of
          invisible settings. Phase 3 copies them across before anything moves, and Phase 4
          replaces them deliberately. Don't skip ahead.
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Your place in Google.</strong> The current shop has pages that people find
          through search. Phase 8 carries those across. If it is skipped, that traffic is gone
          and takes months to rebuild.
        </p>
      </Callout>

      <Checklist storageKey="salty-lamps-migration-progress">
        <div className="admin-doc__phases">

          {/* ------------------------------------------------------------- */}
          <Phase
            number="1"
            title="Gather what you need"
            summary="Half an hour of admin. No changes to anything."
            tone="safe"
            ids={IDS.p0}
          >
            <p>
              Nothing here changes a single setting. It is the list of things that will stop you
              halfway through if you don't have them to hand.
            </p>
            <CheckList>
              <Check id="p0-owner">
                <strong>The owner's details</strong> — full name, the business address, and the
                bank account the shop's takings should be paid into. Stripe will ask for all
                three and won't let you finish without them.
              </Check>
              <Check id="p0-registrar">
                <strong>The login for 123-Reg.</strong> This is where saltylamps.co.uk is
                registered. Not Wix — Wix only manages the settings, it does not own the name.
                You will need this in Phase 3.
              </Check>
              <Check id="p0-wix">
                <strong>The Wix login</strong>, as the account owner rather than a contributor.
              </Check>
              <Check id="p0-mailbox">
                <strong>Decide where the shop's email should land.</strong> Messages to
                addresses on saltylamps.co.uk will be forwarded to one ordinary mailbox that you
                already read. Write down which one.
              </Check>
              <Check id="p0-catalogue">
                <strong>Check the shop is right.</strong> Open Products and Settings in this
                admin and confirm prices, stock and delivery are what you want to go live with.
                It is far easier to fix now than after real orders start arriving.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="2"
            title="Open the owner's Cloudflare account"
            summary="Where the new shop will live. Free to start."
            tone="safe"
            ids={IDS.p1}
          >
            <p>
              Cloudflare is the company that will host the shop, store its product photographs,
              and look after the domain. Everything must be created under the{' '}
              <strong>owner's own account</strong> so the business controls it outright.
            </p>

            <CheckList>
              <Check id="p1-account">
                Sign up at <Ext href="https://dash.cloudflare.com/sign-up">dash.cloudflare.com/sign-up</Ext>{' '}
                using <strong>saltylamps@hotmail.com</strong>. Use a strong, unique password and
                turn on two-factor authentication when offered — this account will hold the shop.
              </Check>
              <Check id="p1-r2">
                Switch on file storage: in the left menu choose <strong>R2 Object Storage</strong>{' '}
                and accept the terms. It asks for a card, but the shop's usage sits inside the
                free allowance. <em>Nothing later works until this is done.</em>
              </Check>
              <Check id="p1-accountid">
                Find your <strong>Account ID</strong>. It is on the right-hand side of the
                dashboard's overview page — a long string of letters and numbers. Copy it
                somewhere safe; you'll paste it in Phase 6.
              </Check>
              <Check id="p1-token">
                Create the key that lets the shop be published. Go to{' '}
                <Ext href="https://dash.cloudflare.com/profile/api-tokens">My Profile → API Tokens</Ext>{' '}
                → <strong>Create Token</strong> → <strong>Create Custom Token</strong>, and give
                it exactly these three permissions, all of type <em>Account</em>:
                <ul className="admin-doc__list">
                  <li><code>Cloudflare Pages</code> → <strong>Edit</strong></li>
                  <li><code>D1</code> → <strong>Edit</strong></li>
                  <li><code>Workers R2 Storage</code> → <strong>Edit</strong></li>
                </ul>
                Cloudflare shows the token <strong>once</strong>. Copy it before leaving the page.
              </Check>
              <Check id="p1-keychain">
                Store that token in your Mac's keychain so it never has to be typed again, and
                never sits in a file. Paste the line below into Terminal, press Return, then
                paste the token at the prompt — it stays hidden as you type.
              </Check>
            </CheckList>

            <Console
              title="Save the Cloudflare key to your keychain"
              note="Nothing is echoed to the screen and nothing is written to your command history. If you ever need to replace the key, run exactly the same line again."
            >{`security add-generic-password -U -a "$USER" -s saltylamps_prod_cloudflare_token -w`}</Console>

            <Callout tone="warn" title="Never paste this key into a chat, an email, or a file">
              It gives full control of the shop's hosting. If it is ever seen by anyone else,
              delete it in the Cloudflare dashboard and make a new one — that takes two minutes
              and costs nothing.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="3"
            title="Move the domain to Cloudflare — with the old shop still running"
            summary="The nervous one. Done right, nobody notices anything."
            tone="care"
            ids={IDS.p2}
          >
            <p>
              Today the settings for saltylamps.co.uk are managed by Wix. This phase moves that
              job to Cloudflare. The trick is that we copy the existing settings across{' '}
              <strong>before</strong> switching, so the Wix shop and the mailbox carry on
              working exactly as they do now. Nothing visible changes.
            </p>

            <Callout tone="info" title="You can undo every part of this">
              If anything looks wrong, putting the old settings back at 123-Reg returns
              everything to how it was. That is why this happens before the new shop exists.
            </Callout>

            <CheckList>
              <Check id="p2-before">
                <strong>Take a record of how things look now</strong>, so you can compare
                afterwards. Paste this into Terminal and keep the output.
              </Check>
            </CheckList>

            <Console
              title="Record the domain's current settings"
              note="This only reads public information — it changes nothing. Keep the output; the checks later in this phase compare against it."
            >{`for t in NS A MX TXT; do
  echo "--- $t"
  dig +short $t saltylamps.co.uk @1.1.1.1
done
echo "--- www"
dig +short www.saltylamps.co.uk @1.1.1.1`}</Console>

            <CheckList>
              <Check id="p2-addzone">
                In Cloudflare choose <strong>Domains → Onboard a domain</strong>, enter{' '}
                <code>saltylamps.co.uk</code>, and pick the <strong>Free</strong> plan. Cloudflare
                reads the current settings and copies them for you.{' '}
                <Ext href="https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/">Cloudflare's own guide</Ext>.
              </Check>
              <Check id="p2-checkdns">
                <strong>Check what it copied, line by line.</strong> The automatic copy is good
                but not guaranteed. The three <code>MX</code> entries pointing at{' '}
                <code>zoho.eu</code> are the ones that carry your email — if any is missing or
                its priority number is wrong, add it by hand before going further.
              </Check>
              <Check id="p2-pointing">
                <strong>Point the old shop at Wix the official way.</strong> Replace the copied
                address entries with the ones Wix publishes for exactly this situation, so the
                Wix shop keeps working no matter what Wix changes behind the scenes:
                <ul className="admin-doc__list">
                  <li>An <strong>A</strong> record for <code>saltylamps.co.uk</code> → <code>185.230.63.107</code></li>
                  <li>A <strong>CNAME</strong> record for <code>www</code> → <code>pointing.wixdns.net</code></li>
                </ul>
                Set both to <strong>DNS only</strong> (the cloud icon grey, not orange).{' '}
                <Ext href="https://support.wix.com/en/article/switching-your-domains-connection-method">Wix's instructions</Ext>.
              </Check>
              <Check id="p2-ns">
                <strong>Now make the switch.</strong> Log in at{' '}
                <Ext href="https://www.123-reg.co.uk/support/domains/how-do-i-change-the-nameservers-for-my-domain-name/">123-Reg</Ext>,
                go to <em>Manage → DNS → Nameservers → Change Nameservers</em>, choose{' '}
                <strong>I'll use my own nameservers</strong>, and enter the two addresses
                Cloudflare gave you. Save.
              </Check>
              <Check id="p2-verify">
                <strong>Wait, then check.</strong> This usually takes under an hour but can take
                a day. Run the check below until the first line shows Cloudflare rather than Wix
                — then open the shop and send yourself an email to prove both still work.
              </Check>
            </CheckList>

            <Console
              title="Check whether the switch has taken effect"
              note="Repeat every so often. When the first block shows names ending in ns.cloudflare.com, the move is done."
            >{`echo "--- who is in charge of the domain now"
dig +short NS saltylamps.co.uk @1.1.1.1
echo "--- the old shop should still load"
curl -s -o /dev/null -w "www.saltylamps.co.uk -> %{http_code}\\n" https://www.saltylamps.co.uk
echo "--- email delivery should be unchanged"
dig +short MX saltylamps.co.uk @1.1.1.1`}</Console>

            <Callout tone="warn" title="Do not continue until all three lines look right">
              The shop should still load and the email entries should still say{' '}
              <code>zoho.eu</code>. If either is wrong, put the old settings back at 123-Reg and
              work out why before going on.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="4"
            title="Take over the shop's email"
            summary="Messages to the domain get forwarded to a mailbox you already read."
            tone="care"
            ids={IDS.p3}
          >
            <p>
              Cloudflare will now receive email sent to addresses on saltylamps.co.uk and forward
              it to an ordinary mailbox of your choosing.
            </p>

            <Callout tone="warn" title="This is forwarding, not a mailbox">
              Mail arrives in the mailbox you nominate. It does <strong>not</strong> create an
              inbox on the domain, your old messages stay where they are, and replying{' '}
              <em>as</em> info@saltylamps.co.uk needs a separate setting in whichever mail app
              you use. Keep the existing mailbox paid up until you are happy.
            </Callout>

            <CheckList>
              <Check id="p3-enable">
                In Cloudflare go to <strong>Email Service → Email Routing</strong>, choose{' '}
                <strong>Onboard Domain</strong>, review the settings it proposes and select{' '}
                <strong>Done</strong>.{' '}
                <Ext href="https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/">Cloudflare's guide</Ext>.
              </Check>
              <Check id="p3-destination">
                Under <strong>Destination Addresses</strong>, add the mailbox you chose in Phase
                1, then <strong>open that mailbox and click the confirmation link</strong>.
                Forwarding does not start until you do.
              </Check>
              <Check id="p3-rules">
                Under <strong>Routing Rules</strong>, add one rule for each address the business
                uses — <code>info@</code>, <code>orders@</code>, <code>sales@</code>, whatever is
                on your paperwork. Add a <strong>catch-all</strong> as well, so a message to an
                address you forgot still reaches you instead of bouncing.
              </Check>
              <Check id="p3-test">
                <strong>Prove it.</strong> From a completely different email account, send a
                message to each address and confirm it arrives. Do not tick this until you have
                actually seen them come in.
              </Check>
              <Check id="p3-zoho">
                Only once that works: log into the old mail provider and{' '}
                <strong>export a copy of everything</strong>. Do not cancel it yet — Phase 10.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="5"
            title="Let the shop send order confirmations"
            summary="Until this is done, customers get no emails at all."
            tone="care"
            ids={IDS.p4}
          >
            <p>
              Order confirmations and despatch notices are sent by a service called Resend. It
              has to prove it is allowed to send on your behalf, otherwise the messages land in
              spam or don't arrive. This was impossible while Wix was in charge of the domain,
              which is why it comes after Phase 3.
            </p>

            <CheckList>
              <Check id="p4-account">
                Create an account at <Ext href="https://resend.com/signup">resend.com</Ext> using{' '}
                <strong>saltylamps@hotmail.com</strong>.
              </Check>
              <Check id="p4-domain">
                Add the domain <code>send.saltylamps.co.uk</code> and choose the{' '}
                <strong>Ireland</strong> region. You are a UK business selling to UK and European
                customers, and the region <strong>cannot be changed later</strong> without
                starting over.
              </Check>
              <Check id="p4-records">
                Resend shows you several entries to add in Cloudflare's <strong>DNS</strong>{' '}
                section. Two things go wrong here more than anything else:
                <ul className="admin-doc__list">
                  <li>
                    When Resend shows a name like <code>send.saltylamps.co.uk</code>, enter only{' '}
                    <strong><code>send</code></strong> in Cloudflare — it adds the rest itself.
                  </li>
                  <li>
                    Set the signing entry (<code>resend._domainkey</code>) to{' '}
                    <strong>DNS only</strong>, grey cloud not orange, or verification fails.
                  </li>
                </ul>
                <Ext href="https://resend.com/docs/dashboard/domains/cloudflare">Resend's Cloudflare guide</Ext>.
              </Check>
              <Check id="p4-spf">
                <strong>Check the sender-permission entry covers everything that sends mail.</strong>{' '}
                Right now this domain has none at all, which is its own small problem. The entry
                you end up with must permit both the shop and your mailbox provider — listing one
                and forgetting the other quietly stops the other one's mail being trusted.
              </Check>
              <Check id="p4-verify">
                Press <strong>Verify</strong> in Resend. It usually passes within minutes. Then
                create an <strong>API key</strong> and keep it for Phase 7.
              </Check>
              <Check id="p4-settings">
                In this admin, open <strong>Settings</strong> and set the sender address to{' '}
                <code>orders@send.saltylamps.co.uk</code>. Send a test from{' '}
                <strong>Emails → Templates</strong> to an address that is <em>not</em> yours, and
                confirm it arrives before switching sending on.
              </Check>
            </CheckList>

            <Console
              title="Check the email settings have taken hold"
              note="Run this a few minutes after saving the entries in Cloudflare."
            >{`echo "--- sender permission (should list the shop and your mailbox provider)"
dig +short TXT saltylamps.co.uk @1.1.1.1
echo "--- the shop's sending signature"
dig +short TXT resend._domainkey.saltylamps.co.uk @1.1.1.1
echo "--- bounce handling"
dig +short MX send.saltylamps.co.uk @1.1.1.1`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="6"
            title="Build the new shop on the owner's account"
            summary="A working shop at a temporary address. Still nothing public."
            tone="safe"
            ids={IDS.p5}
          >
            <p>
              This is the one phase that is almost entirely automatic. A single command creates
              the shop's database, its photograph storage, loads the product catalogue and
              publishes the site — to a temporary address only you know.
            </p>

            <Callout tone="info" title="It runs in two passes, and that is expected">
              The first run creates the database and stops, telling you a reference number. You
              paste that number into one file, run it again, and it finishes. It is safe to run
              as many times as you like.
            </Callout>

            <CheckList>
              <Check id="p5-firstrun">
                Open Terminal, paste the block below, and press Return. It will stop and print a
                long reference number.
              </Check>
            </CheckList>

            <Console
              title="First run — create the shop's database"
              note="Change the folder on the first line if you keep the project somewhere else."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"
export CLOUDFLARE_ACCOUNT_ID=PASTE_YOUR_ACCOUNT_ID_HERE
export PROD_PROJECT=salty-lamps
export PROD_SITE_URL=https://www.saltylamps.co.uk

./deploy-production.sh`}</Console>

            <CheckList>
              <Check id="p5-dbid">
                Open <code>wrangler.prod.toml</code> in the same folder and replace{' '}
                <code>REPLACE_WITH_PRODUCTION_DATABASE_ID</code> with the reference number it
                printed. Save.
              </Check>
              <Check id="p5-deploy">
                Run it again — this time adding the instruction to load the product catalogue.
                Use this <strong>only on the very first run</strong>; it is refused later anyway,
                so real orders can never be overwritten.
              </Check>
            </CheckList>

            <Console
              title="Second run — load the catalogue and publish"
              note="When it finishes it prints the temporary web address for the new shop."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"
export CLOUDFLARE_ACCOUNT_ID=PASTE_YOUR_ACCOUNT_ID_HERE
export PROD_PROJECT=salty-lamps
export PROD_SITE_URL=https://www.saltylamps.co.uk
export SEED_CATALOG=1

./deploy-production.sh`}</Console>

            <CheckList>
              <Check id="p5-check">
                Open the temporary address it printed. Check the products, the photographs, the
                prices and the categories all look right. Sign into <code>/admin</code> on it too.
              </Check>
              <Check id="p5-orders">
                Confirm the new shop has no leftover test orders in it — the check below must
                come back as <code>0</code>.
              </Check>
            </CheckList>

            <Console
              title="Confirm no test data reached the real shop"
              note="Anything other than 0 means practice orders were loaded. Say so before going further."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npx wrangler -c wrangler.prod.toml d1 execute salty-lamps-db --remote \\
  --command "SELECT COUNT(*) AS practice_orders FROM orders WHERE id LIKE 'demo_order_%';"`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="7"
            title="Connect payments and take one real order"
            summary="Real money, on the temporary address, before anyone else can see it."
            tone="care"
            ids={IDS.p6}
          >
            <Callout tone="warn" title="The Stripe account must be registered in the United Kingdom">
              This is fixed when the account is created and <strong>cannot be changed
              afterwards</strong>. Getting it wrong means abandoning the account and starting
              again. A non-UK account cannot offer PayPal at all, and converts every sale into
              another currency at a fee.
            </Callout>

            <CheckList>
              <Check id="p6-account">
                Create the Stripe account in the owner's name at{' '}
                <Ext href="https://dashboard.stripe.com/register">stripe.com</Ext>, country{' '}
                <strong>United Kingdom</strong>, and complete the identity and bank checks.
              </Check>
              <Check id="p6-keys">
                In <em>Developers → API keys</em>, create a <strong>live</strong> key. While you
                are there, go to <em>Settings → Payment methods</em> and switch{' '}
                <strong>Google Pay</strong> on — it is off by default and costs you sales.
              </Check>
              <Check id="p6-webhook">
                In <em>Developers → Webhooks</em>, add an endpoint at the{' '}
                <strong>temporary address</strong> followed by <code>/api/webhook</code>, and
                select only the event <code>checkout.session.completed</code>. Copy its signing
                secret. This is what tells the shop a payment succeeded.
              </Check>
              <Check id="p6-secrets">
                Hand those values to the shop. Run the block below and paste each value when
                asked — nothing is shown on screen and nothing is saved to a file.
              </Check>
            </CheckList>

            <Console
              title="Give the shop its payment and email keys"
              note="Four prompts, one after the other. The last line republishes the site, which is what makes them take effect — without it nothing changes."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npx wrangler pages secret put STRIPE_SECRET_KEY     --project-name salty-lamps
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name salty-lamps
npx wrangler pages secret put RESEND_API_KEY        --project-name salty-lamps
npx wrangler pages secret put SITE_URL              --project-name salty-lamps

npm run build && npx wrangler pages deploy dist --project-name salty-lamps --branch master --commit-dirty=true`}</Console>

            <CheckList>
              <Check id="p6-testorder">
                <strong>Buy something.</strong> Place one genuine, low-value order on the
                temporary address with a real card. Check that it appears in this admin's Orders
                list, that it appears in Stripe, and that the confirmation email arrives. Then
                refund it from Stripe.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="8"
            title="Go live"
            summary="The moment the public address changes hands. Minutes, not hours."
            tone="live"
            ids={IDS.p7}
          >
            <Callout tone="warn" title="This is the step that replaces the old shop">
              After this, saltylamps.co.uk shows the new shop. Do not begin until Phase 7 ended
              with a real order that worked. Pick a quiet time of day.
            </Callout>

            <CheckList>
              <Check id="p7-domain">
                In Cloudflare, open <strong>Workers &amp; Pages → salty-lamps → Custom
                domains</strong>, choose <strong>Set up a domain</strong> and add{' '}
                <code>www.saltylamps.co.uk</code>. Repeat for <code>saltylamps.co.uk</code>.
                Cloudflare sorts out the security certificate itself.{' '}
                <Ext href="https://developers.cloudflare.com/pages/configuration/custom-domains/">Cloudflare's guide</Ext>.
              </Check>
              <Check id="p7-siteurl">
                Update the shop's own idea of its address: run the secret command again for{' '}
                <code>SITE_URL</code> and enter <code>https://www.saltylamps.co.uk</code>.
              </Check>
              <Check id="p7-webhook">
                In Stripe, <strong>edit the existing webhook</strong> to point at{' '}
                <code>https://www.saltylamps.co.uk/api/webhook</code>. Editing it keeps the same
                signing secret; creating a new one instead means redoing Phase 7's key step.
              </Check>
              <Check id="p7-redeploy">
                Republish so the new address takes effect.
              </Check>
            </CheckList>

            <Console
              title="Republish the shop on its real address"
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npx wrangler pages secret put SITE_URL --project-name salty-lamps
npm run build && npx wrangler pages deploy dist --project-name salty-lamps --branch master --commit-dirty=true`}</Console>

            <CheckList>
              <Check id="p7-redirects">
                <strong>Check the old page addresses still work.</strong> The old shop had 54
                pages that people find through Google, and most of them have a different address
                now. They are all redirected — this proves it. Every line must say{' '}
                <code>301</code> or <code>200</code>; anything saying <code>404</code> is lost
                traffic and needs reporting.
              </Check>
              <Check id="p7-live">
                Open the shop as a customer would. Buy something small, for real, and refund it.
              </Check>
            </CheckList>

            <Console
              title="Prove the old page addresses still lead somewhere"
              note="Takes about a minute. A 301 means it forwarded correctly; 404 means that page is lost."
            >{`for p in \\
  /product-page/himalayan-rock-salt-lamp-dolphin \\
  /product-page/salt-lamp-bulb \\
  /product-page/himalayan-rock-salt-lick-equestrian-cattle \\
  /product-page/tequilla-shot-glass \\
  /product-page/himalayan-rock-salt-bowls \\
  /category/all-products \\
  /category/auraframes-uk \\
  /blog
do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://www.saltylamps.co.uk$p")
  printf "%-4s %s\\n" "$code" "$p"
done`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="9"
            title="Tell Google the shop exists"
            summary="Free, and the difference between being found and not."
            tone="safe"
            ids={IDS.p8}
          >
            <p>
              The shop is built to be found — but search engines still have to be told where to
              look. None of this costs anything.
            </p>

            <CheckList>
              <Check id="p8-gsc">
                Add the domain at{' '}
                <Ext href="https://search.google.com/search-console">Google Search Console</Ext>.
                Choose the <strong>Domain</strong> option and add the entry it gives you in
                Cloudflare's DNS section.
              </Check>
              <Check id="p8-sitemap">
                In Search Console, submit <code>https://www.saltylamps.co.uk/sitemap.xml</code>.
                That is the index of every page the shop wants found.
              </Check>
              <Check id="p8-bing">
                Do the same at{' '}
                <Ext href="https://www.bing.com/webmasters">Bing Webmaster Tools</Ext> — it can
                import everything from Google in one click.
              </Check>
              <Check id="p8-business">
                Claim the free <Ext href="https://business.google.com/">Google Business Profile</Ext>{' '}
                for the Stoke-on-Trent address. For a business with a real premises this is
                usually the single largest source of local enquiries.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="10"
            title="Close down the old shop"
            summary="Only after a fortnight of the new one working."
            tone="care"
            ids={IDS.p9}
          >
            <Callout tone="warn" title="Wait two weeks. There is no rush and nothing to gain by hurrying">
              Keeping Wix running costs one more month's subscription. Cancelling it early, and
              then finding something was still needed, costs far more.
            </Callout>

            <CheckList>
              <Check id="p9-export">
                Export everything from Wix you might ever want — the customer list, past orders,
                the two blog articles, and the product photographs at full size.
              </Check>
              <Check id="p9-monitor">
                Watch Search Console for two weeks for pages reported as missing, and watch the
                Orders list here for anything that looks wrong.
              </Check>
              <Check id="p9-wix">
                Cancel the Wix subscription.{' '}
                <Ext href="https://support.wix.com/en/article/disconnecting-a-domain-from-your-site">Disconnect the domain from the Wix site first</Ext>{' '}
                so the cancellation cannot interfere with it.
              </Check>
              <Check id="p9-zoho">
                Cancel the old mail provider, once you are certain every message is arriving in
                the forwarded mailbox and the archive is exported.
              </Check>
            </CheckList>
          </Phase>
        </div>

        <p className="admin-doc__foot">
          Your ticks are saved in this browser only, and will not appear on another computer.
          {' '}<ChecklistReset />
        </p>
      </Checklist>
    </article>
  )
}
