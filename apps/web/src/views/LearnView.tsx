/**
 * Stage 9: LEARN. Not built, and this screen says so.
 *
 * A nine-stage loop with eight screens invites the reader to assume the ninth
 * exists somewhere. It does not, and the missing stage is load-bearing: three
 * numbers elsewhere in the system are uncalibrated *because* nothing tracks
 * outcomes, and one carrier sub-score is permanently neutral for the same
 * reason. Naming them here is what stops those figures from looking settled.
 *
 * The same argument as the quarantine panel, applied to a whole stage.
 */

import { Cell, Note, Panel, Row, Table } from '@vitalink/ui';

/** Figures whose value cannot be checked until outcomes are recorded. */
const UNCALIBRATED = [
  {
    figure: 'exposure decay, 0.75 per hop',
    where: 'TRACE — cascade/domain/exposure.ts',
    problem:
      'A plausible attenuation with nothing validating it. If a shock actually decays faster, ' +
      'distant drugs are being over-flagged; slower, and they are being missed.',
  },
  {
    figure: 'veracity threshold, 0.50',
    where: 'VERIFY — signals/domain/veracity.ts',
    problem:
      'On live data it admitted nothing at all. That may be correct — one agency really is one ' +
      'source — or it may mean the corroboration query is too narrow to find the second one.',
  },
  {
    figure: 'the six carrier sub-score weights',
    where: 'EXECUTE — logistics/domain/score.ts',
    problem:
      'A policy, stored with every answer so it can be argued with. Whether the policy picks ' +
      'carriers that actually deliver on time is exactly what outcome data would settle.',
  },
  {
    figure: 'reliability, fixed at neutral',
    where: 'EXECUTE — the sub-score itself',
    problem:
      'There is no tracking history, so there is no on-time rate. It scores neutral rather than ' +
      'inventing one, which means every carrier is currently treated as equally reliable.',
  },
];

export function LearnView(): React.ReactElement {
  return (
    <>
      <Panel
        title="Stage 9 is not built"
        eyebrow="Stated rather than hidden"
        subtitle="What it would do, and what stays unverifiable until it exists."
      >
        <div className="vl-prose">
          <p>
            LEARN closes the loop: it records what actually happened after a recommendation —
            whether the carrier hit the deadline, whether the shortage materialised, whether the
            cascade reached the drugs it predicted — and feeds that back as calibration and drift
            detection.
          </p>
          <p>
            None of it is here. Building it would have meant either waiting for real outcomes, which
            a four-month project does not have, or generating synthetic ones. The second option was
            available and was refused: a calibration loop trained on invented outcomes produces
            confident numbers with no relationship to reality, which is worse than an honestly
            absent stage.
          </p>
        </div>

        <Note tone="accent" title="What this costs, concretely">
          Four figures below are uncalibrated, and one carrier sub-score is permanently neutral. All
          five are marked in the UI wherever they appear — a neutral fallback shows{' '}
          <em>neutral fallback — why?</em> rather than a plausible-looking score.
        </Note>
      </Panel>

      <Panel
        title="What stays uncalibrated"
        subtitle="Each of these is a number the system reports and cannot yet check."
        flush
      >
        <Table headers={['Figure', 'Where', 'Why it is not settled']}>
          {UNCALIBRATED.map((item) => (
            <Row key={item.figure}>
              <Cell>
                <span className="vl-cell-strong">{item.figure}</span>
              </Cell>
              <Cell>
                <code style={{ fontSize: '0.75rem' }}>{item.where}</code>
              </Cell>
              <Cell>
                <span className="vl-muted">{item.problem}</span>
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <Panel
        title="The rest of what is not here"
        subtitle="A capability list that omits its gaps is not a capability list."
      >
        <div className="vl-prose">
          <p>
            <strong>The physical layer.</strong> No geocoded facilities, hubs or lanes. Everything
            downstream is therefore absent rather than estimated: facilities at risk, population
            affected, rupee loss, cold-chain excursion probability, and lane-level risk in carrier
            scoring.
          </p>
          <p>
            <strong>Five of six carriers.</strong> FedEx, UPS, DHL, Kuehne+Nagel and CEVA have no
            callable public quote API without an approved commercial account. They still appear in
            every comparison table with the verified reason on each row, because a table showing one
            price reads as &ldquo;there is one option&rdquo; when the truth is &ldquo;there is one
            option we can see&rdquo;.
          </p>
          <p>
            <strong>CP-SAT.</strong> The scenario matrix is capped at fifty rows, and enumerating
            fifty rows is exact. The solver field records which method ran, so an eventual switch is
            visible in the data rather than silent.
          </p>
          <p>
            <strong>The language model.</strong> No narrative generation is wired up; the contract
            fields exist and are null. Where a model would eventually write prose, the system prints
            the stored calculation method — which is what it would have been paraphrasing anyway.
          </p>
        </div>
      </Panel>
    </>
  );
}
