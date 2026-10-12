/** Portable, script-free evidence report; every source/analyst string is escaped. */
import type { InvestigationReport, ProductCandidate } from '@vitalink/contracts';

import { decisionLabel, sourceChanges } from './source-history';

export function escapeHtml(value: string | number | boolean | null | undefined): string {
  return String(value ?? 'Not supplied').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}
function link(url: string, label: string): string {
  if (!/^https?:\/\//i.test(url)) return escapeHtml(label) + ' (unsupported URL)';
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
function list(items: string[]): string {
  return '<ul>' + items.map((item) => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
}
function facts(items: [string, string | number | null | undefined][]): string {
  return (
    '<dl>' +
    items
      .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
      .join('') +
    '</dl>'
  );
}
function candidateRow(candidate: ProductCandidate, selected: string | null): string {
  const verdicts = candidate.attributes
    .map(
      (a) => `<li><b>${escapeHtml(a.attribute)}: ${escapeHtml(a.verdict)}</b>
    — ${escapeHtml(a.reference)} / ${escapeHtml(a.candidate)}. ${escapeHtml(a.note)}</li>`,
    )
    .join('');
  return `<article class="candidate"><h3>${escapeHtml(candidate.genericName)} — ${escapeHtml(candidate.productNdc)}${selected === candidate.productNdc ? ' (selected for investigation)' : ''}</h3>
    ${candidateFacts(candidate)}
    <p><b>Exclusions:</b> ${escapeHtml(candidate.exclusions.join(' ') || 'None identified in this screening; not proof of supply or suitability.')}</p><ul>${verdicts}</ul></article>`;
}
function candidateDetails(candidate: ProductCandidate, selected: string | null): string {
  const full = candidateRow(candidate, selected);
  if (candidate.productNdc === selected) return full;
  const signature = candidate.attributes.map((a) => `${a.attribute}: ${a.verdict}`).join('; ');
  return `<details><summary>${escapeHtml(candidate.productNdc)} · ${escapeHtml(candidate.labeler)} · ${escapeHtml(signature)}${candidate.exclusions.length ? ' · EXCLUDED' : ''}</summary>${full}</details>`;
}

function shortageEvidence(candidate: ProductCandidate): string {
  const shortage = candidate.reportedShortage;
  return shortage
    ? `${shortage.status}; availability: ${shortage.availability ?? 'Not supplied'}; source observation: ${shortage.updatedAt}`
    : 'No status matched in retrieved evidence; availability unknown';
}
function candidateFacts(candidate: ProductCandidate): string {
  const approval = candidate.equivalence;
  return facts([
    ['Labeler', candidate.labeler],
    [
      'Dosage form / routes',
      `${candidate.dosageForm ?? 'Not supplied'} / ${candidate.routes.join(', ') || 'Not supplied'}`,
    ],
    [
      'Ingredients / printed strengths',
      candidate.ingredients.map((i) => `${i.name}: ${i.strength ?? 'Not supplied'}`).join('; '),
    ],
    [
      'Listing start / expiry',
      `${candidate.marketingStartDate ?? 'Not supplied'} / ${candidate.listingExpiryDate ?? 'Not supplied'}`,
    ],
    [
      'Application / marketing status',
      approval
        ? `${approval.applicationNumber} / ${approval.marketingStatus ?? 'Not supplied'}`
        : 'No approval evidence resolved',
    ],
    [
      'Therapeutic-equivalence evidence',
      approval
        ? `${approval.teCode ?? 'No code resolved'}. ${approval.teCodeNote}`
        : 'Not established',
    ],
    ['FDA reported shortage', shortageEvidence(candidate)],
  ]);
}
function evidence(report: InvestigationReport): string {
  const original = report.investigation.incidentSnapshot;
  const latest = report.sourceHistory.latest;
  return `<section><h2>Source evidence preserved when the case opened</h2>${facts([
    ['Event', original.kind],
    ['Product', original.product],
    ['Company', original.company],
    ['Source status', original.status],
    ['Presentation availability', original.availability],
    ['Reason', original.reason],
    ['Presentation', original.presentation],
    ['Product NDCs', original.productNdcs.join(', ') || 'Not supplied'],
    ['Source-reported date', original.publishedAt],
    ['Source fetched at', original.provenance.fetched_at],
    ['Recall classification', original.classification],
    ['Lots / codes', original.lots],
    ['Reported distribution', original.distribution],
    [
      'Geographic scope',
      original.location
        ? `${original.location.label}; recalling-firm city, not a plant or delivery route`
        : 'No source location supplied',
    ],
  ])}
    <p>${link(original.sourceUrl, 'FDA record query')} — live query contents can change; the preserved facts above remain fixed.</p>
    <p>${link(original.provenance.source_url, original.provenance.source_name)}; query: ${escapeHtml(original.provenance.query)}</p>
    <h3>Latest retained monitor observation</h3>${
      latest
        ? facts([
            ['Source status', latest.status],
            ['Availability', latest.availability],
            ['Fetched at', latest.provenance.fetched_at],
          ])
        : '<p>The record is absent from the current bounded monitor. This does not establish resolution.</p>'
    }</section>`;
}
function history(report: InvestigationReport): string {
  const timeline = report.sourceHistory;
  const rows = timeline.versions
    .map((version, index) => {
      const previous = timeline.versions[index - 1];
      const changes = previous ? sourceChanges(previous.snapshot, version.snapshot) : [];
      return `<article><h3>Observed ${escapeHtml(version.observedAt)}</h3><p>${escapeHtml(version.origin === 'retained_before_tracking' ? 'Retained observation from before history tracking began.' : 'Observed during a live source refresh.')}</p>
      ${
        previous
          ? list(changes.map((c) => `${c.label}: ${c.before} → ${c.after}`))
          : facts([
              ['Source status', version.snapshot.status],
              ['Availability', version.snapshot.availability],
              ['Reason', version.snapshot.reason],
            ])
      }
      <p>Retained at ${escapeHtml(version.recordedAt)}. Fact fingerprint: <code>${escapeHtml(version.digest)}</code>.</p>
      <p>${link(version.snapshot.provenance.source_url, 'Source retrieval query')}</p></article>`;
    })
    .join('');
  return `<section><h2>Observed source-change timeline</h2><p>${escapeHtml(timeline.coverage)}</p>
    <p>Observation times bound changes; they are not exact onset or resolution times. No archive matching or complete pre-tracking history is implied.</p>
    ${timeline.hasMore ? '<p class="warning">Earlier retained versions are outside this 100-version report window.</p>' : ''}
    ${rows || '<p>No tracked fact versions yet. The case-opening evidence above is still preserved.</p>'}</section>`;
}
function archiveHistory(report: InvestigationReport): string {
  const archive = report.archive;
  const rows = archive.observations
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.capture.capturedAt)}</td><td>${String(o.rows.length)}</td><td>${escapeHtml(['Current', 'Resolved', 'To Be Discontinued', 'Unknown'].map((status) => `${status}: ${String(o.rows.filter((r) => r.status === status).length)}`).join('; '))}</td><td>${link(o.provenance.source_url, 'Original archived CSV')}<br>Parser: ${escapeHtml(o.parser.mode)}${list(o.parser.issues)}</td></tr>`,
    )
    .join('');
  return `<section><h2>Archived printed-medicine observations</h2><p>${escapeHtml(archive.printedMedicineName)}; ${escapeHtml(archive.basis)}.</p><p>${escapeHtml(archive.coverage)}</p>
    <p>${String(archive.observations.length)} matching captures from ${String(archive.storedCaptures)} imported captures. Counts are retained presentation rows, not independent episodes. Full source rows and hashes are included in the companion evidence JSON; source dates may contain flagged errors.</p>
    ${rows ? `<table><thead><tr><th>Capture time (UTC)</th><th>Rows</th><th>Source statuses</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No exact printed-name history is available. No historical product identity is inferred.</p>'}</section>`;
}
function analysis(report: InvestigationReport): string {
  const value = report.investigation.analysis;
  if (!value) {
    return '<section><h2>Medicine identification</h2><p>Analysis has not been performed.</p></section>';
  }
  return `<section><h2>Medicine identification and evidence</h2>${facts([
    ['Medicine', value.drugName],
    ['Analysed at', value.analysedAt],
    ['Relationship', value.match.kind],
    [
      'Directly identified',
      value.match.directlyIdentified
        ? 'Yes; reported scope and lot restrictions still apply.'
        : 'No; association only.',
    ],
    ['Match reasoning', value.match.reason],
    ['Label storage evidence', value.storageText],
    [
      'Observed network',
      `${String(value.nodes.length)} nodes / ${String(value.edges.length)} associations; labelers are not proven physical suppliers or plants.`,
    ],
  ])}
    <h3>Assumptions and coverage</h3>${list(value.assumptions)}
    <h3>Optional reliability model</h3><p>Long-run model and proxy/scenario inputs, not an incident-specific forecast. Sensitivity bands are not calibrated confidence intervals.</p>
    ${
      value.reliability
        ? `<pre>${escapeHtml(
            JSON.stringify(
              {
                input: value.reliability.input,
                availability: value.reliability.r,
                expectedShortage: value.reliability.expected_shortage_s,
                rateOrigins: value.reliability.rate_origins,
                assumptions: value.reliability.assumptions,
              },
              null,
              2,
            ),
          )}</pre>`
        : `<p>${escapeHtml(value.reliabilityError ?? 'No model result available.')}</p>`
    }
    ${value.historyProvenance ? `<p>${link(value.historyProvenance.source_url, 'Recall proxy source')} (fetched ${escapeHtml(value.historyProvenance.fetched_at)})</p>` : ''}</section>`;
}
function candidates(report: InvestigationReport): string {
  const set = report.investigation.candidates;
  if (!set) {
    return '<section><h2>Product candidates</h2><p>No candidate discovery saved. No alternative supply is established.</p></section>';
  }
  return `<section><h2>Product candidates for investigation</h2><p>Shared ingredients and matching attributes do not establish substitutability, supplier stock or a commercial offer. Professional review is required.</p>
    ${facts([
      ['Reference product NDC', set.referenceNdc],
      ['Comparison made at', set.createdAt],
      [
        'Retrieved / FDA query total',
        `${String(set.coverage.retrieved)} / ${set.coverage.reportedTotal === null ? 'unknown' : String(set.coverage.reportedTotal)}`,
      ],
      [
        'Coverage',
        set.coverage.truncated
          ? 'Partial retrieval; additional listings may exist.'
          : 'Bounded query retrieval; not a complete market or supply assessment.',
      ],
    ])}
    ${list(set.limits)}${set.sources.map((s) => `<p>${link(s.source_url, s.source_name)} — ${escapeHtml(s.fetched_at)}; ${escapeHtml(s.query)}</p>`).join('')}
    <p>The selected candidate is expanded. Open other listings to inspect their full reasoning before printing; the companion JSON retains every comparison.</p>
    ${set.candidates.map((c) => candidateDetails(c, report.investigation.decision?.candidateNdc ?? null)).join('')}</section>`;
}
function decision(report: InvestigationReport): string {
  const record = report.investigation;
  const action = record.decision;
  const plan = record.plan;
  return `<section><h2>Analyst decision and response</h2>${
    action
      ? facts([
          ['Next action', decisionLabel(action.action)],
          ['Rationale', action.rationale],
          ['Candidate NDC', action.candidateNdc],
          ['Recorded at', action.recordedAt],
        ])
      : '<p>No public-evidence next action has been recorded.</p>'
  }
    <p>This records analyst intent; it does not place an order, dispatch a shipment or approve a clinical substitution.</p>
    ${
      plan
        ? `<h3>Optional response scenario</h3><p>Operator-supplied inputs. ${escapeHtml(plan.input.inputBasis)}</p>
      <pre>${escapeHtml(JSON.stringify(plan, null, 2))}</pre>`
        : '<p>No stock, quote or cost scenario was supplied. Public evidence does not establish private inventory or supplier offers.</p>'
    }
    <h3>Notes</h3>${record.notes.map((n) => `<article><p>${escapeHtml(n.at)}</p><p class="preserve">${escapeHtml(n.text)}</p></article>`).join('') || '<p>No analyst notes.</p>'}
    <h3>Case activity</h3>${list(record.history.map((h) => `${h.at}: ${h.action}`))}</section>`;
}
const reportStyle = `body{font:15px/1.55 Arial,sans-serif;color:#17283d;background:#fff;margin:0}main{max-width:1000px;margin:40px auto;padding:0 28px}header{border-bottom:3px solid #167d94}h1{font-size:30px;line-height:1.2}h2{font-size:22px;color:#145d72;margin-top:30px}h3{font-size:16px}section{border-bottom:1px solid #bbcbd7;padding-bottom:22px}dl{display:grid;grid-template-columns:200px 1fr;gap:7px 18px}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}a{color:#145d72}article{border-left:2px solid #cadbe2;padding-left:14px;margin:20px 0}pre{font:11px/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f7;padding:14px}.preserve{white-space:pre-wrap}.warning{border-left:3px solid #bc7620;padding:12px;background:#fff6e6}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;border-bottom:1px solid #bbcbd7;padding:8px;vertical-align:top}code{overflow-wrap:anywhere;font-size:11px}@media(max-width:600px){main{padding:0 16px}dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:10px}}@media print{main{margin:0;max-width:none;padding:0}body{font-size:10pt}h2,h3{break-after:avoid}article,dl{break-inside:avoid}a{text-decoration:none}pre{font-size:8pt}header{margin-bottom:20px}@page{margin:18mm}}`;
export function renderInvestigationReport(report: InvestigationReport): string {
  const record = report.investigation;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>${escapeHtml(record.analysis?.drugName ?? record.title)} — VitaLink investigation</title><style>${reportStyle}</style></head><body><main>
    <header><p>VitaLink · Pharmaceutical disruption investigation</p><h1>${escapeHtml(record.analysis?.drugName ?? record.title)}</h1>
    ${facts([
      ['Case', record.id],
      ['Workflow status', record.status],
      ['Opened', record.createdAt],
      ['Last case update', record.updatedAt],
      ['Report generated', report.generatedAt],
    ])}</header>
    <p class="warning">US FDA regulatory evidence. A national shortage is not local stock; a recall is limited to its reported products and lots. Candidates require professional review. This report is decision support, not prescribing or procurement execution.</p>
    ${evidence(report)}${decision(report)}${history(report)}${archiveHistory(report)}${analysis(report)}${candidates(report)}
    <section><h2>Source coverage at report generation</h2>${
      report.feeds
        .map(
          (
            f,
          ) => `<article><h3>${escapeHtml(f.label)} — ${escapeHtml(f.state)}</h3><p>${escapeHtml(f.coverage)}</p>
      ${facts([
        ['Last successful refresh', f.succeededAt],
        ['Latest attempt', f.attemptedAt],
        ['Retrieved rows', f.records],
        ['Error', f.error ?? 'None recorded'],
      ])}</article>`,
        )
        .join('') || '<p>Source health unavailable.</p>'
    }</section>
    <footer><p>Read offline in a browser. Use its Print command to save a PDF. Links lead to live queries whose contents may change; preserved case and version facts remain the report evidence.</p></footer></main></body></html>`;
}
