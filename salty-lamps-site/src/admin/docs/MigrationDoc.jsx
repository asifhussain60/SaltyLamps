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
// THREE THINGS THAT MOVED, AND WHY.
//
//   The backup moved to the FRONT. It used to sit in the final phase, after the
//   domain had moved and the Wix subscription had been cancelled — the one
//   moment the export is hardest to take and most needed. Nothing is touched
//   until there is a copy of everything.
//
//   Proving the shop got its own phases. "Check the products look right" and one
//   test order was the whole of the verification. Regression, email, dashboards
//   and search each now have a phase, because each fails in a way the others
//   would not reveal.
//
//   The admin got its own hostname. It used to be a page on the shop, with a link
//   to it in the customer navigation. Phase 9 moves it.
//
// Ticks persist in the browser (see Checklist in docParts.jsx). The `id` on each
// Check is part of that stored state: renaming one silently un-ticks it for
// anyone mid-migration. Ids for steps that already existed are therefore kept
// exactly as they were, even where the phase around them has been renumbered.
import React from 'react'
import { Callout, Check, CheckList, Checklist, ChecklistReset, Console, Ext, Figure, Phase } from './docParts.jsx'
import flowUrl from '../../../docs/diagrams/migration-flow.svg'

// Every Check id, grouped by phase, so each phase header can count its own
// progress without the ids being written out twice.
const IDS = {
  p0: ['p0-owner', 'p0-registrar', 'p0-wix', 'p0-mailbox', 'p0-catalogue'],
  pb: ['pb-products', 'pb-orders', 'pb-contacts', 'pb-media', 'pb-blog', 'pb-inventory', 'pb-cloudflare', 'pb-store'],
  p1: ['p1-account', 'p1-r2', 'p1-accountid', 'p1-token', 'p1-keychain'],
  p2: ['p2-before', 'p2-dnssec', 'p2-ttl', 'p2-addzone', 'p2-checkdns', 'p2-pointing', 'p2-ns', 'p2-verify'],
  p3: ['p3-enable', 'p3-destination', 'p3-rules', 'p3-test', 'p3-zoho'],
  p4: ['p4-account', 'p4-domain', 'p4-records', 'p4-spf', 'p4-verify', 'p4-settings'],
  p5: ['p5-firstrun', 'p5-dbid', 'p5-deploy', 'p5-check', 'p5-orders'],
  pc: ['pc-export', 'pc-import', 'pc-read', 'pc-plan', 'pc-apply', 'pc-images', 'pc-verify'],
  pa: ['pa-domain', 'pa-access', 'pa-policy', 'pa-aud', 'pa-secrets', 'pa-redeploy', 'pa-verify', 'pa-openhosts'],
  p6: ['p6-account', 'p6-keys', 'p6-webhook', 'p6-secrets', 'p6-testorder'],
  pr: ['pr-install', 'pr-run', 'pr-mobile', 'pr-shop', 'pr-basket', 'pr-admin', 'pr-orders', 'pr-products', 'pr-stock'],
  pe: ['pe-order', 'pe-adminalert', 'pe-shipped', 'pe-delivered', 'pe-refunded', 'pe-cancelled', 'pe-lowstock', 'pe-enquiry', 'pe-refundreq', 'pe-resend', 'pe-inbox'],
  pd: ['pd-zero', 'pd-order', 'pd-kpis', 'pd-charts', 'pd-reports', 'pd-clock'],
  ps: ['ps-speed', 'ps-schema', 'ps-redirects', 'ps-sitemap', 'ps-noindex', 'ps-copy'],
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

      <Figure
        src={flowUrl}
        alt="Seventeen migration phases in order: gather, back up, Cloudflare account, domain, receive email, send email, build, catalogue, admin subdomain, payments, regression, email proof, dashboards, SEO proof, go live, search engines, close Wix."
        caption="The whole migration on one line. Everything left of Go live is reversible; everything right of it is housekeeping."
      />

      <Callout tone="ok" title="The old shop stays up until the very last moment">
        Phases 1 to 14 build the new shop quietly alongside the existing one. Nothing your
        customers can see changes until <strong>Phase 15</strong>. Up to that point every single
        step can be undone — and the last phase of this page tells you how, at each stage.
      </Callout>

      <Callout tone="warn" title="Three things that are easy to break, and hard to un-break">
        <p style={{ margin: '4px 0' }}>
          <strong>Email.</strong> The mailbox on this domain works because of a handful of
          invisible settings. Phase 4 copies them across before anything moves, Phase 5 takes them
          over and Phase 6 replaces them deliberately. Don't skip ahead.
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Your place in Google.</strong> The current shop has pages that people find
          through search. Phases 14 and 16 carry those across. If they are skipped, that traffic is
          gone and takes months to rebuild.
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Your only copy of anything.</strong> Wix holds your product list, your order
          history and your customer list. Phase 2 takes a copy of all of it before a single setting
          changes, because the cheapest moment to do that is now and the most expensive is later.
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
                You will need this in Phase 4.
              </Check>
              <Check id="p0-wix">
                <strong>The Wix login</strong>, as the account owner rather than a contributor.
                A contributor cannot export the order list, which you need in the next phase.
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
            title="Back up everything, before you touch anything"
            summary="An hour. Nothing changes — but this is the phase that makes every later one safe."
            tone="safe"
            ids={IDS.pb}
          >
            <p>
              Wix holds the only copy of your order history and your customer list. Once the
              domain moves and the subscription lapses, getting them out ranges from awkward to
              impossible. So they come out <strong>now</strong>, while everything is still working
              normally and there is no pressure.
            </p>

            <Callout tone="info" title="Keep all of this in one folder, somewhere backed up">
              A folder in iCloud or Dropbox called <code>Salty Lamps — Wix backup</code> with
              today's date is fine. It contains customer names, addresses and email addresses, so
              treat it the way you would a filing cabinet: private, and not emailed around.
            </Callout>

            <CheckList>
              <Check id="pb-products">
                <strong>Export the product list.</strong> In the Wix dashboard open{' '}
                <strong>Products</strong>, tick the box at the top left to select every product,
                then <strong>More Actions → Export</strong>. Save the CSV.{' '}
                <Ext href="https://support.wix.com/en/article/wix-stores-exporting-your-product-list">Wix's instructions</Ext>.
                <br />
                <em>If the shop has more than 5,000 rows</em> Wix splits the export — take every
                file, not just the first.
              </Check>
              <Check id="pb-orders">
                <strong>Export the orders — twice, in both shapes.</strong> Open{' '}
                <strong>Orders</strong>, tick the box at the top left, then <strong>Export</strong>.
                Wix offers you <em>Orders</em> (one row per order) and <em>Item purchased</em> (one
                row per item). Take both: the first is your sales record, the second is the only
                thing that shows what was actually in each order.{' '}
                <Ext href="https://support.wix.com/en/article/exporting-orders-3126323">Wix's instructions</Ext>.
                <br />
                Note the times in the file are <strong>UTC</strong>, not British time.
              </Check>
              <Check id="pb-contacts">
                <strong>Export the customer list.</strong> Wix dashboard →{' '}
                <strong>Contacts</strong> → select all → <strong>Export</strong>. This is the list
                you would need to tell people the shop has moved, and it does not come back.
              </Check>
              <Check id="pb-inventory">
                <strong>Write down the stock figures.</strong> The product export includes them,
                but take a screenshot of the Inventory page as well. It is the one number that
                will have changed by the time you go live, and having a picture of "what it was on
                the day" settles any later argument in seconds.
              </Check>
              <Check id="pb-media">
                <strong>Download the photographs at full size.</strong> Wix dashboard →{' '}
                <strong>Media</strong> → select all → download. The new shop has its own
                compressed copies, but the originals are the only version you can ever re-crop or
                re-edit from.
              </Check>
              <Check id="pb-blog">
                <strong>Copy the two blog posts.</strong> They are the only pages on the old site
                with no equivalent on the new one. Paste the text and save the images somewhere;
                Phase 15 redirects their addresses, but a redirect preserves the link, not the
                writing.
              </Check>
              <Check id="pb-store">
                <strong>Take the machine-readable copy.</strong> The command below records every
                address the live site publishes, along with each page's title and description, and
                downloads the images it references. That list is what Phase 15 checks its redirects
                against — without it, a product added since August has an address nobody has
                thought about, and it becomes a dead link the day you go live.
              </Check>
            </CheckList>

            <Console
              title="Take a copy of the live site"
              note="Reads only — it cannot change anything on Wix. Takes a few minutes. The result lands in a folder called backups/wix/ with today's date."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

node scripts/backup-wix.mjs`}</Console>

            <CheckList>
              <Check id="pb-cloudflare">
                <strong>Back up the new shop too.</strong> The test site already holds work — the
                catalogue, your wording, the categories, the email templates. Take a copy of that
                as well, so this phase leaves you with a copy of <em>both</em> shops.
              </Check>
            </CheckList>

            <Console
              title="Take a copy of the test site's database and images"
              note="Writes into d1/backups/. It prints how many products and orders it saved — read those numbers rather than assuming, and stop if they look wrong."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

./scripts/backup-cloudflare.sh`}</Console>

            <Callout tone="warn" title="Do not go past this phase until the folder exists">
              Everything after this point is reversible <em>because</em> of this phase. Skipping
              it does not make the migration faster; it makes every later mistake permanent.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="3"
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
                somewhere safe; you'll paste it in Phase 7.
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
            number="4"
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
                afterwards. Paste this into Terminal and keep the output. The last two blocks
                matter more than they look: one tells you whether a security feature is switched
                on that would take the domain completely offline if you moved it without turning
                it off first.
              </Check>
            </CheckList>

            <Console
              title="Record the domain's current settings"
              note="This only reads public information — it changes nothing. Keep the output; the checks later in this phase compare against it."
            >{`for t in NS A MX TXT CAA; do
  echo "--- $t"
  dig +short $t saltylamps.co.uk @1.1.1.1
done
echo "--- www"
dig +short www.saltylamps.co.uk @1.1.1.1
echo "--- is DNSSEC switched on? (any output here means YES)"
dig +short DS saltylamps.co.uk @1.1.1.1`}</Console>

            <CheckList>
              <Check id="p2-dnssec">
                <strong>If that last block printed anything, stop and turn DNSSEC off first.</strong>{' '}
                It is a security feature that ties the domain to whoever currently answers for it.
                Change the nameservers while it is on and the domain stops resolving{' '}
                <em>entirely</em> — no website, no email, for everyone, until it is switched off
                and the change works its way around the internet. Turn it off in the 123-Reg
                control panel, wait a few hours, and re-run the block above until it prints
                nothing. If it printed nothing the first time, there is nothing to do.
              </Check>
              <Check id="p2-ttl">
                <strong>The day before you switch, shorten the "how long to remember this"
                setting.</strong> In the 123-Reg DNS panel, set the TTL on the existing records to
                the lowest value offered (usually 300 seconds). This is what makes an undo take
                minutes instead of a day, and it costs nothing. Do it, then wait a day before the
                next step.
              </Check>
              <Check id="p2-addzone">
                In Cloudflare choose <strong>Domains → Onboard a domain</strong>, enter{' '}
                <code>saltylamps.co.uk</code>, and pick the <strong>Free</strong> plan. Cloudflare
                reads the current settings and copies them for you.{' '}
                <Ext href="https://developers.cloudflare.com/fundamentals/manage-domains/add-site/">Cloudflare's own guide</Ext>.
                <br />
                <strong>Write down the two nameservers it gives you</strong>, and keep the old Wix
                ones from the block above next to them. Those two lists are your undo button.
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
                Cloudflare gave you — <strong>those two and nothing else</strong>. Cloudflare will
                sit on "Pending Nameserver Update" indefinitely if an old one is left behind. Save.
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
              <code>zoho.eu</code>. If either is wrong, put the old nameservers back at 123-Reg
              and work out why before going on. That is what you wrote them down for.
            </Callout>

            <Callout tone="info" title="You are not transferring the domain, only who answers for it">
              The registration stays at 123-Reg and nothing about the renewal changes. If you ever
              do want to move the registration itself, note that <code>.co.uk</code> domains do not
              use the transfer codes you may have seen for <code>.com</code> — they move by
              changing something called an <strong>IPS tag</strong> at Nominet, which the losing
              registrar does. That is a separate job for a quieter week, and nothing here needs it.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="5"
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
                In Cloudflare go to <strong>Email → Email Routing</strong>, choose{' '}
                <strong>Get started</strong> or <strong>Onboard Domain</strong>, review the
                settings it proposes and select <strong>Done</strong>.{' '}
                <Ext href="https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/">Cloudflare's guide</Ext>.
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
                <strong>export a copy of everything</strong>. Do not cancel it yet — Phase 17.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="6"
            title="Let the shop send order confirmations"
            summary="Until this is done, customers get no emails at all."
            tone="care"
            ids={IDS.p4}
          >
            <p>
              Order confirmations and despatch notices are sent by a service called Resend. It
              has to prove it is allowed to send on your behalf, otherwise the messages land in
              spam or don't arrive. This was impossible while Wix was in charge of the domain,
              which is why it comes after Phase 4.
            </p>

            <CheckList>
              <Check id="p4-account">
                Create an account at <Ext href="https://resend.com/signup">resend.com</Ext> using{' '}
                <strong>saltylamps@hotmail.com</strong>.
              </Check>
              <Check id="p4-domain">
                Add the domain <code>saltylamps.co.uk</code> and choose the{' '}
                <strong>Ireland</strong> region. You are a UK business selling to UK and European
                customers, and the region <strong>cannot be changed later</strong> without
                deleting the domain and redoing all of this.
                <br />
                Resend will then show you records to add on <code>send.saltylamps.co.uk</code> —
                it creates that sub-address itself. You do not add it as a separate domain.
              </Check>
              <Check id="p4-records">
                Resend shows you several entries to add in Cloudflare's <strong>DNS</strong>{' '}
                section. Two things go wrong here more than anything else:
                <ul className="admin-doc__list">
                  <li>
                    When Resend shows a name like <code>send.saltylamps.co.uk</code>, enter only{' '}
                    <strong><code>send</code></strong> in Cloudflare — it adds the rest itself.
                    Type the whole thing and you end up with{' '}
                    <code>send.saltylamps.co.uk.saltylamps.co.uk</code>, which verifies nothing.
                  </li>
                  <li>
                    Set the signing entry to <strong>DNS only</strong>, grey cloud not orange, or
                    verification fails.
                  </li>
                </ul>
                <Ext href="https://resend.com/docs/dashboard/domains/cloudflare">Resend's Cloudflare guide</Ext>.
              </Check>
              <Check id="p4-spf">
                <strong>Check you have not disturbed the mailbox's own permissions.</strong> This
                is worth understanding rather than just doing, because it is widely got wrong:
                the shop's sending permission goes on{' '}
                <code>send.saltylamps.co.uk</code>, and your mailbox provider's goes on the plain
                domain. They are two different records in two different places and{' '}
                <strong>neither replaces the other</strong>. If somebody tells you to merge them
                into one line on the main domain, they are describing a different setup, and doing
                it stops your own mail being trusted.
                <br />
                Separately: this domain has <em>no</em> sending permission of its own today, which
                means mail from the mailbox is unauthenticated. That is not something this
                migration breaks, but it is the natural moment to fix it — ask your mailbox
                provider for their SPF line and add it to the plain domain.
              </Check>
              <Check id="p4-verify">
                Press <strong>Verify</strong> in Resend. It usually passes within minutes. Then
                create an <strong>API key</strong> and keep it for Phase 10.
              </Check>
              <Check id="p4-settings">
                In this admin, open <strong>Settings</strong> and set the sender address to{' '}
                <code>orders@send.saltylamps.co.uk</code>. Leave <strong>Send transactional
                email</strong> switched <em>off</em> for now — Phase 12 turns it on, after a test
                send has actually been seen to arrive.
              </Check>
            </CheckList>

            <Console
              title="Check the email settings have taken hold"
              note="Run this a few minutes after saving the entries in Cloudflare. The first block is the shop's permission and the second is your mailbox's — they are separate on purpose, and both should have something in them."
            >{`echo "--- the shop's sending permission (on send.)"
dig +short TXT send.saltylamps.co.uk @1.1.1.1
echo "--- your mailbox's sending permission (on the plain domain)"
dig +short TXT saltylamps.co.uk @1.1.1.1
echo "--- the shop's sending signature"
dig +short TXT resend._domainkey.send.saltylamps.co.uk @1.1.1.1
echo "--- bounce handling"
dig +short MX send.saltylamps.co.uk @1.1.1.1`}</Console>

            <Callout tone="info" title="If a record comes back empty, check where Resend put it">
              Resend can place these on the plain domain instead of on <code>send.</code>,
              depending on how the domain was added. Read the names in the Resend dashboard and
              check those exact names — the four commands above assume the usual layout, not a
              guaranteed one.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="7"
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
              note="When it finishes it prints the temporary web address for the new shop. Write that address down — the next four phases all use it."
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
  --command "SELECT
    (SELECT COUNT(*) FROM orders      WHERE id LIKE 'demo_order_%') AS practice_orders,
    (SELECT COUNT(*) FROM order_items WHERE order_id LIKE 'demo_order_%') AS practice_lines,
    (SELECT COUNT(*) FROM email_outbox) AS emails_logged,
    (SELECT COUNT(*) FROM enquiries) AS enquiries;"`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="8"
            title="Load today's real catalogue from the Wix backup"
            summary="So the shop opens with the prices and stock you actually have."
            tone="care"
            ids={IDS.pc}
          >
            <p>
              Phase 7 loaded the catalogue as it stood when this site was built. Months have
              passed. Prices have moved, stock has moved, products have come and gone. This phase
              takes the export from Phase 2 and brings the new shop up to date — so it opens with
              your real catalogue rather than a snapshot of an old one.
            </p>

            <Callout tone="info" title="What the import changes, and what it deliberately leaves alone">
              Wix is the shop that has been trading, so Wix decides{' '}
              <strong>names, prices, stock and what is on sale</strong>. It does{' '}
              <em>not</em> overwrite the descriptions, photographs or categories on the new site —
              those were written and prepared for this shop and do not exist in Wix at all.
              Nothing is ever deleted: a product missing from an export is reported to you, never
              removed, because a filtered export looks exactly like a discontinued product and
              only one of those is recoverable.
            </Callout>

            <CheckList>
              <Check id="pc-export">
                <strong>Take a fresh export, today.</strong> Not the one from Phase 2 — that is
                your archive. Prices and stock have moved even since then. Wix dashboard →{' '}
                <strong>Products</strong> → select all → <strong>More Actions → Export</strong>.
              </Check>
              <Check id="pc-import">
                <strong>Read it in.</strong> The command below reads the export and writes what it
                found into the shop's catalogue file. It <em>does not</em> touch any database yet.
              </Check>
            </CheckList>

            <Console
              title="Read the Wix export into the catalogue file"
              note="Change the file name to match what you downloaded. Nothing is written to any shop by this command — it only prepares the file and tells you what it would change."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

node scripts/catalogue-reset.mjs import-wix --csv=~/Downloads/catalog_products.csv`}</Console>

            <CheckList>
              <Check id="pc-read">
                <strong>Read what it printed — properly, not at a glance.</strong> It lists every
                new product, every changed price, and everything in the shop that was not in the
                export. That last list is the one to look at hardest: if it names products you are
                still selling, your export was filtered and you should take it again with
                everything selected.
              </Check>
              <Check id="pc-plan">
                <strong>See what would change in the real shop</strong> before changing it. This
                is a rehearsal and can be run as often as you like.
              </Check>
            </CheckList>

            <Console
              title="Rehearse the change against the new shop"
              note="Reports only. Use the temporary address the deploy printed in Phase 7."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

node scripts/catalogue-reset.mjs plan --api=https://salty-lamps.pages.dev`}</Console>

            <CheckList>
              <Check id="pc-apply">
                <strong>Apply it</strong>, once the rehearsal looks right. Every change is written
                the same way a person would write it in this admin, so all of it appears in the
                shop's own history with a name against it.
              </Check>
            </CheckList>

            <Console
              title="Write the catalogue into the new shop"
              note="Safe to re-run: it only writes what differs. It never recreates a product, so no order can ever be detached from what was bought."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

node scripts/catalogue-reset.mjs apply --api=https://salty-lamps.pages.dev`}</Console>

            <Callout tone="warn" title="If it says the shop is behind a sign-in">
              After Phase 9 the admin is protected, and this tool then needs its own pass to get
              in. Create one in Cloudflare under <strong>Zero Trust → Access controls → Service
              auth</strong>, add it to the admin application's policy, and put its two values in
              front of the command:{' '}
              <code>CF_ACCESS_CLIENT_ID</code> and <code>CF_ACCESS_CLIENT_SECRET</code>. The tool
              tells you this itself if you hit it. Running Phase 8 before Phase 9 avoids it
              entirely, which is why they are in this order.
            </Callout>

            <CheckList>
              <Check id="pc-images">
                <strong>Give any brand-new product a photograph.</strong> The import flags these
                explicitly. Wix's images live on Wix's servers and this shop does not serve from
                there, so a new product arrives with nothing to show. Upload photographs in{' '}
                <strong>Products</strong> before going live, or those items launch as blank cards.
              </Check>
              <Check id="pc-verify">
                <strong>Check the shop against the export.</strong> Open{' '}
                <strong>Products</strong> and <strong>Inventory</strong> here and spot-check five
                products against the CSV — name, price, stock. Then confirm the counts below match
                what the import reported.
              </Check>
            </CheckList>

            <Console
              title="Count what is actually in the new shop"
              note="Compare these against the numbers the import printed. A mismatch means something did not apply — say so rather than continuing."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npx wrangler -c wrangler.prod.toml d1 execute salty-lamps-db --remote \\
  --command "SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM products WHERE visible = 1) AS on_sale,
    (SELECT COUNT(*) FROM skus) AS variants,
    (SELECT COUNT(*) FROM products WHERE image IS NULL OR image = '') AS missing_a_photo,
    (SELECT COUNT(*) FROM orders) AS orders_so_far;"`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="9"
            title="Move the admin onto its own address, and lock it"
            summary="The back office stops being part of the shop."
            tone="care"
            ids={IDS.pa}
          >
            <p>
              Until now the admin has been a page on the shop itself, at <code>/admin</code>, with
              a link to it in the menu every customer sees. From this phase it lives at{' '}
              <strong>admin.saltylamps.co.uk</strong>, it asks who you are before it opens, and on
              the shop's own address it simply does not exist.
            </p>

            <Callout tone="warn" title="Do this in the order written, or you will lock yourself out">
              The sign-in has to exist <em>before</em> the shop is told to send you to it. Each
              step below is safe on its own; only the sequence keeps you on the right side of the
              door. The last step is a check, and it is not optional.
            </Callout>

            <CheckList>
              <Check id="pa-domain">
                In Cloudflare open <strong>Workers &amp; Pages → salty-lamps → Custom
                domains</strong>, choose <strong>Set up a domain</strong> and add{' '}
                <code>admin.saltylamps.co.uk</code>. Cloudflare creates the DNS entry and the
                security certificate itself. Nothing on the shop changes.
              </Check>
              <Check id="pa-access">
                Create the sign-in. Go to{' '}
                <Ext href="https://one.dash.cloudflare.com">Zero Trust</Ext> →{' '}
                <strong>Access controls → Applications → Add an application →
                Self-hosted</strong>. Name it <code>Salty Lamps admin</code> and give it the
                hostname <code>admin.saltylamps.co.uk</code> — the whole hostname, no path.{' '}
                <Ext href="https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/">Cloudflare's guide</Ext>.
              </Check>
              <Check id="pa-policy">
                Add a <strong>policy</strong>: action <em>Allow</em>, rule <em>Emails</em>, and
                list the individual addresses that should get in. Use named addresses, not a
                whole-domain rule — "anyone with an email at this company" is how these get left
                open for years.
              </Check>
              <Check id="pa-aud">
                Open the application's <strong>Overview</strong> tab and copy the{' '}
                <strong>Application Audience (AUD) Tag</strong>. Note your{' '}
                <strong>team domain</strong> too — the first part of{' '}
                <code>&lt;team&gt;.cloudflareaccess.com</code>, shown under{' '}
                <strong>Settings → Custom Pages</strong>.
              </Check>
              <Check id="pa-secrets">
                Tell the shop those two values, and tell it where the admin now lives. Three
                prompts, below.
              </Check>
            </CheckList>

            <Console
              title="Tell the shop where the admin lives and how to check who you are"
              note="Three prompts. ACCESS_AUD is the tag you copied, ACCESS_TEAM_DOMAIN is the team name, and ADMIN_HOSTS is admin.saltylamps.co.uk exactly. Nothing appears on screen as you paste."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npx wrangler pages secret put ACCESS_AUD         --project-name salty-lamps
npx wrangler pages secret put ACCESS_TEAM_DOMAIN --project-name salty-lamps
npx wrangler pages secret put ADMIN_HOSTS        --project-name salty-lamps`}</Console>

            <CheckList>
              <Check id="pa-redeploy">
                <strong>Republish.</strong> Settings only take effect on a fresh publish — this
                has caught this project out before, and the symptom is everything looking exactly
                as it did.
              </Check>
            </CheckList>

            <Console
              title="Republish so the new settings take effect"
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site
export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s saltylamps_prod_cloudflare_token -w | tr -d '[:space:]')"

npm run build && npx wrangler pages deploy dist --project-name salty-lamps --branch master --commit-dirty=true`}</Console>

            <CheckList>
              <Check id="pa-verify">
                <strong>Check both doors.</strong> The block below must print exactly what its
                notes say. This is the step that tells you whether you can still get in and
                whether anybody else can.
              </Check>
              <Check id="pa-openhosts">
                <strong>Make sure the open-door setting names nothing here.</strong> There is a
                setting called <code>ADMIN_OPEN_HOSTS</code> that lets the test site's admin
                answer without a sign-in. If it exists on this production project at all, remove
                it. The last check in the block below is what proves it.
              </Check>
            </CheckList>

            <Console
              title="Prove the admin moved, and that it is shut"
              note="Line 1 must NOT be 200. Line 2 must be 404. Line 3 should be 302 (sent to sign in) — a 200 there means the door is open to anyone and must be fixed before going further."
            >{`echo "--- the shop must not serve the admin"
curl -s -o /dev/null -w "  shop /admin           -> %{http_code}\\n" https://salty-lamps.pages.dev/admin
echo "--- the shop must not serve the admin's data"
curl -s -o /dev/null -w "  shop /api/admin/orders -> %{http_code}\\n" https://salty-lamps.pages.dev/api/admin/orders
echo "--- the admin address must ask who you are"
curl -s -o /dev/null -w "  admin /admin          -> %{http_code}\\n" https://admin.saltylamps.co.uk/admin
echo "--- and must not hand over data without a sign-in"
curl -s -o /dev/null -w "  admin /api/admin/orders -> %{http_code}\\n" https://admin.saltylamps.co.uk/api/admin/orders`}</Console>

            <Callout tone="ok" title="Then sign in properly, in a browser">
              Open <code>https://admin.saltylamps.co.uk/admin</code>. You should be asked to sign
              in with your email, receive a code, and land in this admin. Bookmark it. The shop no
              longer links to it from anywhere, which is the point.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="10"
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
                Create a <strong>live</strong> secret key. While you are there, go to{' '}
                <em>Settings → Payment methods</em> and switch <strong>Google Pay</strong> on —
                it is off by default and costs you sales.
              </Check>
              <Check id="p6-webhook">
                Add the message that tells the shop a payment succeeded. In Stripe open{' '}
                <strong>Workbench → Webhooks</strong> (Stripe has replaced the old Developers
                page with Workbench; the old page still works if you see it) →{' '}
                <strong>Add endpoint</strong>. Give it the <strong>temporary address</strong>{' '}
                followed by <code>/api/webhook</code>, and select only the event{' '}
                <code>checkout.session.completed</code>. Copy its signing secret.
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
                <br />
                <em>Keep this order.</em> Phases 12 and 13 use it as the thing they check against.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="11"
            title="Test everything, properly"
            summary="An hour, mostly waiting. This is what a bad launch feels like avoided."
            tone="care"
            ids={IDS.pr}
          >
            <p>
              One test order proves that one path works. This phase checks the rest of the shop:
              every page a customer can reach, every screen you will use, on a computer and on a
              phone. Most of it a machine does for you.
            </p>

            <CheckList>
              <Check id="pr-install">
                <strong>Set the tests up once.</strong> This downloads what they need. You only
                ever do it once on a given computer.
              </Check>
            </CheckList>

            <Console
              title="One-time setup"
              note="A few minutes, and a few hundred megabytes. It touches nothing outside its own folder."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site/tests

npm install
npx playwright install chromium`}</Console>

            <CheckList>
              <Check id="pr-run">
                <strong>Run them against the new shop.</strong> They check the shop pages, the
                basket, the pages a customer lands on after paying, the contact forms, every admin
                screen, the search-engine files, and that the admin is where it should be and
                nowhere else. Everything must pass.
              </Check>
            </CheckList>

            <Console
              title="Run the full check against the new shop"
              note="Ten minutes or so. Every line should end in 'passed'. If something fails it prints the page, the step and a screenshot — send that, don't summarise it."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site/tests

E2E_BASE_URL=https://salty-lamps.pages.dev \\
E2E_ADMIN_HOST=https://admin.saltylamps.co.uk \\
npx playwright test`}</Console>

            <CheckList>
              <Check id="pr-mobile">
                <strong>Then look at it yourself, on your phone.</strong> Open the temporary
                address and go through: home, a category, a product, add to basket, open the
                basket. The tests confirm it works; only you can say whether it{' '}
                <em>reads</em> right, and most of your customers will be on a phone.
              </Check>
              <Check id="pr-shop">
                <strong>Check every category has products in it</strong>, and that no category is
                empty. An empty category is a dead end that search engines find and customers
                bounce off.
              </Check>
              <Check id="pr-basket">
                <strong>Try to break the basket.</strong> Add several items, change a quantity to
                zero, remove one, reload the page, add something that is out of stock. Nothing
                should let you buy something the shop does not have.
              </Check>
              <Check id="pr-admin">
                <strong>Walk every admin page</strong> — Dashboard, Orders, Products, Categories,
                Inventory, Reports, Emails, Settings — and confirm each one loads and shows
                something sensible rather than an error or an empty frame.
              </Check>
              <Check id="pr-orders">
                <strong>Take the test order through its whole life.</strong> Using the order from
                Phase 10: mark it packed, then shipped with a tracking number, then delivered.
                Each step should stick after a page reload. Phase 12 checks the emails those steps
                send.
              </Check>
              <Check id="pr-products">
                <strong>Change something and change it back.</strong> Edit a product's price,
                save, reload, confirm it changed on the shop, then set it back. Upload a
                photograph to a product and delete it again. This proves the parts of the admin
                you will use most.
              </Check>
              <Check id="pr-stock">
                <strong>Check stock actually moves.</strong> Note the stock figure for the item
                you bought in Phase 10 and confirm it went down by one. Then set an item to zero
                and confirm the shop shows it as unavailable rather than letting it be bought.
              </Check>
            </CheckList>

            <Callout tone="warn" title="A failure here is a reason to stop, not a reason to hurry">
              Everything in this phase is cheap to fix now and expensive to fix once the domain
              has moved and customers are on the site. Nothing below is more urgent than
              something above that is failing.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="12"
            title="Prove every email the shop can send"
            summary="Eleven messages. Each one is a customer wondering what happened."
            tone="care"
            ids={IDS.pe}
          >
            <p>
              The shop sends eleven different messages. Phase 6 proved it is{' '}
              <em>allowed</em> to send; this phase proves each one actually arrives, reads
              correctly, and links back to the right place. An order confirmation that silently
              fails is a customer who thinks you have taken their money and vanished.
            </p>

            <Callout tone="info" title="Read the Emails → Activity page as you go">
              Every send is recorded there with its outcome. <strong>Sent</strong> means it went.{' '}
              <strong>Failed</strong> means it did not. <strong>Skipped</strong> is neither — it
              means the shop deliberately did not send, usually because sending is switched off or
              there is no address. A page full of "skipped" is not an outage.
              <br />
              There is <strong>no automatic retry</strong>. Anything that failed is re-sent by
              hand from that page — which is why the last check in this phase exists.
            </Callout>

            <CheckList>
              <Check id="pe-order">
                <strong>Order confirmation.</strong> Switch{' '}
                <strong>Send transactional email</strong> on in Settings, then place one more
                small order using an address that is <em>not</em> the shop's own — a personal
                Gmail, a friend's. It must arrive, show the right items and total, and its links
                must open the real shop.
              </Check>
              <Check id="pe-adminalert">
                <strong>The new-order alert to you.</strong> The same order should also notify the
                shop's own address. Check it arrived and that replying to it replies to the{' '}
                <em>customer</em>, not to yourself.
              </Check>
              <Check id="pe-shipped">
                <strong>Despatch notice.</strong> Mark that order shipped with a real tracking
                number. The customer email must arrive and its tracking button must open the
                courier's page.
              </Check>
              <Check id="pe-delivered">
                <strong>Delivered notice.</strong> Mark it delivered. Confirm one email arrives —
                and confirm that marking it delivered a second time sends nothing, because the
                shop only announces a genuine change.
              </Check>
              <Check id="pe-refunded">
                <strong>Refund confirmation.</strong> Refund that order from this admin. The
                customer email must arrive, and the money must actually appear back in Stripe.
              </Check>
              <Check id="pe-cancelled">
                <strong>Cancellation.</strong> On a separate test order, cancel rather than refund,
                and confirm that email arrives too.
              </Check>
              <Check id="pe-lowstock">
                <strong>Low-stock alert.</strong> Set an item's stock to just above the alert
                level in Inventory, then buy enough of it to cross that level. You should get one
                alert. Buy another and you should get <em>nothing</em> — it warns on the crossing,
                not on every sale, which is what stops you learning to ignore them.
              </Check>
              <Check id="pe-enquiry">
                <strong>The three contact forms.</strong> Send one message through each of the
                storefront's forms — general, trade, and the newsletter sign-up. Each should
                appear in <strong>Emails → Enquiries</strong> and reach the shop's address.
              </Check>
              <Check id="pe-refundreq">
                <strong>Customer refund request.</strong> Submit one through the refund-request
                page using the test order's details. It should reach you. Submit it again straight
                away and it should be quietly ignored — that is a deliberate limit of one per
                order per hour, so a frustrated customer clicking repeatedly does not flood your
                inbox.
              </Check>
              <Check id="pe-resend">
                <strong>Practise re-sending one.</strong> In <strong>Emails → Activity</strong>,
                pick any message and re-send it. This is the only recovery there is when something
                fails, so find out now that you know where the button is.
              </Check>
              <Check id="pe-inbox">
                <strong>Check one landed in the inbox, not in spam.</strong> Open one of the
                customer emails in Gmail, choose <em>Show original</em>, and confirm it says{' '}
                <strong>PASS</strong> next to SPF, DKIM and DMARC. If any says fail, the records
                from Phase 6 are not right yet — and every order confirmation from here on is
                going to a spam folder.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="13"
            title="Check the dashboards tell the truth"
            summary="Ten minutes. The numbers you will run the business on."
            tone="safe"
            ids={IDS.pd}
          >
            <p>
              Every figure in this admin is counted from real orders — none of it is decorative.
              This phase confirms that on the day you open, so that when the dashboard tells you
              something surprising later you believe it.
            </p>

            <Callout tone="info" title="On day one the dashboard is nearly empty, and that is correct">
              Zero revenue, an empty chart and "no orders yet" is what a brand-new shop looks
              like. It is not broken. The check below is that the <em>one</em> order you have
              placed shows up exactly where it should.
            </Callout>

            <CheckList>
              <Check id="pd-zero">
                <strong>Confirm there is no practice data.</strong> The test site has a year of
                invented orders in it so the charts had something to draw. None of it must be
                here. Run the check from Phase 7 again — every number must be <code>0</code>{' '}
                except for the orders you placed yourself.
              </Check>
              <Check id="pd-order">
                <strong>Find your test order in the Orders list</strong>, open it, and confirm the
                customer, the items, the total and the delivery address are all right.
              </Check>
              <Check id="pd-kpis">
                <strong>Check it moved the dashboard.</strong> Open the Dashboard and confirm the
                order appears in <em>Revenue today</em>, in <em>this week</em>, in{' '}
                <em>this month</em>, in <em>Recent orders</em>, and in the fulfilment breakdown at
                whatever stage you left it. If it is in one and not another, say so.
              </Check>
              <Check id="pd-charts">
                <strong>Check the charts.</strong> The 14-day sales chart should show a bar on
                today and nothing before it. Top products should name what you bought.
              </Check>
              <Check id="pd-reports">
                <strong>Open Reports and download all three exports.</strong> Sales, best sellers
                and stock valuation. Each should download a spreadsheet you can open — these are
                what your accountant will ask for.
              </Check>
              <Check id="pd-clock">
                <strong>If you are testing late in the evening, look again in the morning.</strong>{' '}
                The shop's day runs on British time, so an order placed at half past midnight in
                summer belongs to the new day. Worth one glance to confirm nothing has jumped a
                day, because a figure that is quietly a day out is very hard to notice later.
              </Check>
            </CheckList>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="14"
            title="Prove the shop can be found — before anyone can find it"
            summary="The last thing that is cheap to fix. After the switch it is not."
            tone="care"
            ids={IDS.ps}
          >
            <p>
              The old shop has years of standing with Google. Most of its addresses are different
              on the new site, because this shop publishes a page for each size and style where
              Wix published one for the product. Every one of those old addresses is forwarded —
              this phase proves it, while it still costs nothing to fix.
            </p>

            <CheckList>
              <Check id="ps-redirects">
                <strong>Check every old address still leads somewhere.</strong> The command below
                takes the list of addresses recorded in Phase 2 and checks each one against the
                new shop. Anything reported here is traffic that would be lost on the day you
                switch.
              </Check>
            </CheckList>

            <Console
              title="Check the old addresses against the new shop"
              note="Uses the backup from Phase 2. 'every live URL is either built or redirected' is the answer you want. Anything listed needs a forwarding rule adding before Phase 15."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site

npm run build
node scripts/backup-wix.mjs --no-images --compare-redirects`}</Console>

            <CheckList>
              <Check id="ps-sitemap">
                <strong>Check the shop's index of itself.</strong> The tests from Phase 11 already
                confirm every address the shop advertises actually loads — if that phase passed,
                this is done. Worth re-running here if anything changed in Phase 8.
              </Check>
              <Check id="ps-schema">
                <strong>Check what Google will show.</strong> Paste a product address into{' '}
                <Ext href="https://search.google.com/test/rich-results">Google's Rich Results Test</Ext>.
                It should find a <em>Product</em> with a price, availability and a breadcrumb
                trail, and report no errors. This is the difference between a plain blue link and
                a result with a price on it.
              </Check>
              <Check id="ps-speed">
                <strong>Check the shop is quick enough.</strong> Paste the temporary address into{' '}
                <Ext href="https://pagespeed.web.dev/">PageSpeed Insights</Ext> and read the{' '}
                <strong>mobile</strong> score. Speed is part of how Google ranks you and most of
                your customers are on a phone. If the largest item on screen takes more than about
                two and a half seconds, the usual cause is one very large photograph — say so and
                it can be fixed.
              </Check>
              <Check id="ps-noindex">
                <strong>Confirm only one address is offered to Google.</strong> The shop answers on
                its temporary address as well as its real one, and the admin has an address of its
                own. Only the real shop should be indexed. The block below proves it.
              </Check>
              <Check id="ps-copy">
                <strong>Read the front page and one product page as a stranger would.</strong>{' '}
                Does it say what you sell, where you are, and why to buy from you? No tool checks
                this and it matters more than any of the above.
              </Check>
            </CheckList>

            <Console
              title="Confirm the temporary and admin addresses are hidden from search engines"
              note="The first two should say Disallow: / — they are copies and must not compete with the real shop. Run the third AFTER Phase 15; it must NOT say that."
            >{`echo "--- temporary address (should be hidden)"
curl -s https://salty-lamps.pages.dev/robots.txt | head -3
echo "--- admin address (should be hidden)"
curl -s https://admin.saltylamps.co.uk/robots.txt | head -3
echo "--- the real shop (must NOT be hidden — check after Phase 15)"
curl -s https://www.saltylamps.co.uk/robots.txt | head -3`}</Console>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="15"
            title="Go live"
            summary="The moment the public address changes hands. Minutes, not hours."
            tone="live"
            ids={IDS.p7}
          >
            <Callout tone="warn" title="This is the step that replaces the old shop">
              After this, saltylamps.co.uk shows the new shop. Do not begin until Phases 11 to 14
              have all passed. Pick a quiet time of day — a Tuesday morning, not a Friday evening
              — so that if something needs attention, you are awake and the week is ahead of you.
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
                signing secret; creating a new one instead means redoing Phase 10's key step.
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
                <strong>Run the whole check again, against the real address.</strong> Everything
                that passed on the temporary address should pass here. This is the same command as
                Phase 11 with one word changed, and it is the fastest way to know the switch went
                cleanly.
              </Check>
              <Check id="p7-live">
                Open the shop as a customer would. Buy something small, for real, and refund it.
                Confirm the confirmation email arrives — the address in its links has just
                changed, and this is the first time that has been true.
              </Check>
            </CheckList>

            <Console
              title="Re-run the full check against the real address"
              note="Ten minutes. Everything must pass here as it did in Phase 11. The apex check at the end confirms saltylamps.co.uk without the www reaches the shop rather than nothing."
            >{`cd ~/PROJECTS/SaltyLamps/salty-lamps-site/tests

E2E_BASE_URL=https://www.saltylamps.co.uk \\
E2E_ADMIN_HOST=https://admin.saltylamps.co.uk \\
npx playwright test

echo "--- the address without www should reach the shop"
curl -s -o /dev/null -w "  saltylamps.co.uk -> %{http_code}\\n" https://saltylamps.co.uk`}</Console>

            <Callout tone="info" title="If the address without www does not work">
              Add a <strong>Redirect Rule</strong> in Cloudflare under{' '}
              <strong>Rules → Redirect Rules</strong> sending <code>saltylamps.co.uk</code> to{' '}
              <code>https://www.saltylamps.co.uk</code>. It cannot be done in the shop's own
              settings file — that file is only consulted once a request has already reached the
              right address, so it can forward a page but never a whole domain.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="16"
            title="Tell Google the shop exists"
            summary="Free, and the difference between being found and not."
            tone="safe"
            ids={IDS.p8}
          >
            <p>
              The shop is built to be found — but search engines still have to be told where to
              look. None of this costs anything. Do it the same day you go live, not weeks later.
            </p>

            <CheckList>
              <Check id="p8-gsc">
                Add the domain at{' '}
                <Ext href="https://search.google.com/search-console">Google Search Console</Ext>.
                Choose the <strong>Domain</strong> option rather than URL prefix — it covers the
                address with and without www, and both http and https, in one go. It gives you a
                line of text to add in Cloudflare's DNS section as a <strong>TXT</strong> record
                on the plain domain. <strong>Leave that record in place afterwards</strong>;
                removing it un-verifies you.
              </Check>
              <Check id="p8-sitemap">
                In Search Console, open <strong>Sitemaps</strong> and submit{' '}
                <code>sitemap.xml</code>. That is the index of every page the shop wants found.
              </Check>
              <Check id="p8-bing">
                Do the same at{' '}
                <Ext href="https://www.bing.com/webmasters">Bing Webmaster Tools</Ext> — it can
                import everything from Google in one click, and it is what feeds several other
                search tools besides Bing.
              </Check>
              <Check id="p8-business">
                Claim the free <Ext href="https://business.google.com/">Google Business Profile</Ext>{' '}
                for the Stoke-on-Trent address. For a business with real premises this is usually
                the single largest source of local enquiries, and it is free.
              </Check>
            </CheckList>

            <Callout tone="info" title="What to expect, so the first fortnight is not alarming">
              Search results do not move immediately. Expect Search Console to report errors it is
              still working through for a week or two, and expect the old addresses to keep
              appearing in results for a while before the new ones replace them. That is the
              forwarding doing its job. What you are watching for is the <em>Pages</em> report
              showing your product pages as indexed, and the number climbing rather than falling.
            </Callout>
          </Phase>

          {/* ------------------------------------------------------------- */}
          <Phase
            number="17"
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
                <strong>Check the Phase 2 backup is still complete and still findable.</strong>{' '}
                Products, both order exports, contacts, the media library and the two blog posts.
                This is the last moment any of it can be taken again.
              </Check>
              <Check id="p9-monitor">
                Watch Search Console for two weeks for pages reported as missing, and watch the
                Orders list here for anything that looks wrong. Re-run the Phase 11 check once a
                week for the first month — it takes ten minutes and catches a slow failure while
                it is still small.
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

        {/* ------------------------------------------------------------- */}
        <h2>If something goes wrong — how to undo it, at each stage</h2>

        <p>
          Everything before Phase 15 can be put back. This is what "put back" means at each point,
          so the answer is here rather than being worked out under pressure.
        </p>

        <div className="admin-doc__table-wrap">
          <table className="admin-doc__table">
            <thead>
              <tr><th>If this went wrong</th><th>What you do</th><th>How long until it is normal again</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Phase 4</strong> — the domain moved and something broke</td>
                <td>Put the two original Wix nameservers back at 123-Reg. You wrote them down in <code>p2-addzone</code>.</td>
                <td>Under an hour, if you shortened the TTL a day before. Up to a day if you did not.</td>
              </tr>
              <tr>
                <td><strong>Phase 5</strong> — email forwarding is not arriving</td>
                <td>The old mailbox is still live and still paid for. Nothing has been taken away from it. Turn Email Routing off in Cloudflare and mail resumes as before.</td>
                <td>Minutes.</td>
              </tr>
              <tr>
                <td><strong>Phase 6</strong> — the sending domain will not verify</td>
                <td>Nothing is broken; the shop simply cannot email customers yet. Delete the domain in Resend and add it again cleanly. A half-verified entry left in place confuses the next attempt.</td>
                <td>No customer impact — this is all before go-live.</td>
              </tr>
              <tr>
                <td><strong>Phase 8</strong> — the catalogue import did the wrong thing</td>
                <td>The file it wrote is <code>data/catalogue.json</code>. Restore the previous version and apply again. Nothing was deleted, so no order lost what it was for.</td>
                <td>Minutes.</td>
              </tr>
              <tr>
                <td><strong>Phase 9</strong> — you cannot get into the admin</td>
                <td>Remove the <code>ADMIN_HOSTS</code> setting and republish. The admin returns to the shop's own address exactly as before while you sort the sign-in out.</td>
                <td>One republish, about two minutes.</td>
              </tr>
              <tr>
                <td><strong>Phase 15</strong> — the shop is live and something is badly wrong</td>
                <td>In Cloudflare's DNS, point <code>www</code> back at <code>pointing.wixdns.net</code> and the plain domain back at the Wix address. The Wix site is still there and still paid for until Phase 17 — which is the whole reason Phase 17 is last.</td>
                <td>Minutes, because the domain is already on Cloudflare and answers instantly.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Callout tone="ok" title="The one thing you cannot undo is not having a backup">
          Every row above assumes Phase 2 was done. It is the only phase with no undo of its own,
          which is why it comes second and why nothing after it is dangerous.
        </Callout>

        <p className="admin-doc__foot">
          Your ticks are saved in this browser only, and will not appear on another computer.
          {' '}<ChecklistReset />
          <br />
          This page is mirrored as Markdown at <code>docs/migration.md</code>.
        </p>
      </Checklist>
    </article>
  )
}
