import React from 'react'
import { Callout, Check, CheckList, Checklist, ChecklistReset, Console, Ext, Phase } from './docParts.jsx'
import { paymentDecision } from './payment-decision.mjs'
import { migrationPlan } from './migration-plan.mjs'

function PlanTable({ headings, rows }) {
  return <div className="admin-doc__table-wrap"><table className="admin-doc__table">
    <thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
  </table></div>
}

export default function MigrationDoc() {
  const plan = migrationPlan
  return <article className="admin-doc admin-doc--migration">
    <p className="admin-doc__lead">{plan.introduction}</p>
    <Callout tone="warn" title={`Migration readiness — reviewed ${plan.reviewed}`}>
      <p>{plan.status}</p>
      <p>These are new readiness checks. Earlier checklist ticks remain stored in this browser, but are not proof that the revised requirements have passed.</p>
    </Callout>
    <h2>Numbered migration status</h2>
    <PlanTable headings={['Number', 'Item', 'Status', 'Evidence and remaining work']} rows={plan.phases.map((phase, index) => [index + 1, phase.title, ...plan.progress[phase.id]])} />
    <h2>Access still needs to be proven</h2>
    <PlanTable headings={['Service', 'Required access', 'Verified state']} rows={plan.access} />
    <h2>Use free services where they fit</h2>
    <PlanTable headings={['Need', 'Choice', 'Boundary']} rows={plan.costs} />
    <Checklist storageKey="salty-lamps-migration-readiness-2026-09-audit2">
      <div className="admin-doc__phases">
        {plan.phases.map((phase, index) => <Phase key={phase.id} number={String(index + 1)} title={phase.title}
          summary={phase.summary} ids={phase.checks.map((_, i) => `readiness-${phase.id}-${i}`)}>
          <p><strong>Owner:</strong> {phase.owner}</p>
          <CheckList>{phase.checks.map((check, i) => <Check key={i} id={`readiness-${phase.id}-${i}`}>{check}</Check>)}</CheckList>
          {(phase.commands || []).map(command => <Console key={command}>{command}</Console>)}
          <Callout title="Before continuing">{phase.gate}</Callout>
        </Phase>)}
      </div>
      <p className="admin-doc__foot">Ticks are personal browser notes. They do not authorize a deployment or prove that a check passed. <ChecklistReset label="Clear readiness ticks" /></p>
    </Checklist>
    <h2>Payment decision and administrator handoff</h2>
    {paymentDecision.sections.map(section => <section key={section.title}>
      <h3>{section.title}</h3>
      {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    </section>)}
    <ul>{paymentDecision.sources.map(([label, url]) => <li key={url}><Ext href={url}>{label}</Ext></li>)}</ul>
    <h2>Sources checked for this review</h2>
    <ul>{plan.sources.map(([label, url]) => <li key={url}><Ext href={url}>{label}</Ext></li>)}</ul>
    <p className="admin-doc__foot">This page and docs/migration.md use the same migration plan. An automated check prevents the written guide from drifting.</p>
  </article>
}
