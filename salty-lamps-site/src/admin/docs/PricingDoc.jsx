import React from 'react'
import { Callout, Ext } from './docParts.jsx'
import { migrationPlan, pricingIntroduction, pricingDomainNote, pricingStripeNote } from './migration-plan.mjs'

export default function PricingDoc() {
  return <article className="admin-doc">
    <p className="admin-doc__lead">{pricingIntroduction}</p>
    <Callout tone="info" title={`Free-first pricing — reviewed ${migrationPlan.reviewed}`}>
      Cloudflare incoming email forwarding is free. Sending order emails to customers through Cloudflare requires Workers Paid. The current plan retains Resend’s free allowance.
    </Callout>
    <div className="admin-doc__table-wrap"><table className="admin-doc__table">
      <thead><tr><th>Need</th><th>Choice</th><th>Boundary</th></tr></thead>
      <tbody>{migrationPlan.costs.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
    <h2>Stripe payment costs</h2>
    <p>{pricingStripeNote} <Ext href="https://stripe.com/gb/pricing">Stripe UK pricing</Ext>.</p>
    <h2>Domain and mailbox costs</h2>
    <p>{pricingDomainNote}</p>
    <p>Keep the current Zoho mailbox until the mail archive, incoming forwarding and replies from the business address have all been proven. Free email forwarding alone does not replace a full mailbox.</p>
    <h2>Provider sources</h2>
    <ul>{migrationPlan.sources.filter(([label]) => !label.startsWith('Wix')).map(([label,url]) => <li key={url}><Ext href={url}>{label}</Ext></li>)}</ul>
    <p className="admin-doc__foot">This page and docs/pricing.md share the same cost data and are checked together automatically.</p>
  </article>
}
