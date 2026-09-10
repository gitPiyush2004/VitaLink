/**
 * Stages 6–7: SIMULATE and DECIDE.
 *
 * The two answers on this screen are different kinds of answer, and keeping them
 * apart is the whole design.
 *
 * The **Pareto front** is a fact about the options: a dominated scenario is no
 * better on any axis and worse on at least one, so nobody's preferences make it
 * worth choosing. No weights, no opinion. It is drawn as a chart because that is
 * the one place a picture genuinely beats a table — "these four are the real
 * trade-offs and the rest are strictly worse" is a shape, and reading it off a
 * list of numbers takes a minute.
 *
 * The **objective** picks one point off that front, which requires saying how
 * many rupees a day of shortage is worth. That is policy, so the weights are
 * shown with the answer and every term's raw value sits beside its normalised
 * one — because min-max normalisation turns a one-point spread into a decisive
 * 0.000-versus-1.000, and a reader has to be able to see that happening.
 */

import { useState } from 'react';

import type { QuoteStatus } from '@vitalink/contracts';
import {
  Cell,
  CellStack,
  Empty,
  ErrorNote,
  Meter,
  MeterList,
  Method,
  Note,
  Panel,
  QuantityValue,
  QuoteStatusChip,
  Row,
  ScatterChart,
  Select,
  Stat,
  StatGrid,
  Table,
  UnavailableList,
  type ScatterPoint,
} from '@vitalink/ui';

import { listScenarioRuns, type ScenarioRunRow } from '../api/queries';

import { useApi } from './useApi';

const PERCENT = 100;
const DECIMALS = { shortage: 4, objective: 3, weight: 2 };
const DATETIME_LENGTH = 16;

export function DecideView(): React.ReactElement {
  const runs = useApi(() => listScenarioRuns(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown = runs.data?.find((one) => one.id === selectedId) ?? runs.data?.[0] ?? null;

  if (runs.error !== null) {
    return (
      <Panel title="Scenario matrix">
        <ErrorNote text={runs.error} />
      </Panel>
    );
  }

  if (shown === null) {
    return (
      <Panel
        title="Scenario matrix"
        eyebrow="Stages 6 and 7"
        subtitle="The joint sourcing × logistics matrix. It pairs sourcing options against real carrier quotes, so it needs a cascade and a logistics recommendation first."
      >
        <Empty reason="No scenario run stored yet. Run stage 8 first, then: npm run decide --workspace @vitalink/api -- <cascade-id> <drug-id> <recommendation-id>" />
      </Panel>
    );
  }

  const chosen = shown.scenarios.find((one) => one.id === shown.chosenScenarioId);
  const dominated = shown.scenarios.length - shown.paretoFront.length;

  return (
    <>
      <StatGrid>
        <Stat
          label="Scenarios enumerated"
          value={shown.scenarios.length}
          note="each sourcing option × each eligible carrier quote"
          tone="derived"
        />
        <Stat
          label="On the Pareto front"
          value={shown.paretoFront.length}
          note={`${String(dominated)} were strictly worse and discarded with no judgement`}
          tone="real"
        />
        <Stat
          label="Chosen"
          value={chosen?.sourcing.label ?? '—'}
          note="picked by the weighted objective, which is a policy"
          tone="scenario"
        />
        <Stat
          label="Rupee loss avoided"
          unavailable="No NPPA ceiling prices are joined to demand, so there is no honest rupee basis. A plausible figure here would be the most quotable number this system produces and entirely fabricated."
          note="needs an NPPA client"
          tone="danger"
        />
      </StatGrid>

      <FrontPanel run={shown} />
      <MatrixPanel run={shown} all={runs.data ?? []} onSelect={setSelectedId} />
      <ChoicePanel run={shown} />
    </>
  );
}

/** The front, drawn. No weights involved in anything on this panel. */
function FrontPanel({ run }: { run: ScenarioRunRow }): React.ReactElement {
  const onFront = new Set(run.paretoFront.map((one) => one.scenarioId));

  const points: ScatterPoint[] = run.scenarios.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    x: scenario.outcome.totalCostInr,
    y: scenario.outcome.expectedShortage.value,
    onFront: onFront.has(scenario.id),
    chosen: scenario.id === run.chosenScenarioId,
  }));

  return (
    <Panel
      title="Pareto front — the genuine trade-offs"
      eyebrow="Stage 7, without an opinion"
      subtitle="A dominated scenario is no better on either axis and worse on one, so it can be discarded with no judgement at all. What survives is where buying an improvement on one axis costs you something on the other."
    >
      <ScatterChart
        points={points}
        xLabel="total cost (INR)"
        yLabel="expected shortage"
        formatX={(value) => value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        formatY={(value) => value.toFixed(DECIMALS.shortage)}
      />
      <p className="vl-chart-caption">
        Filled points are on the front; hollow points are dominated. The ringed point is the one the
        weighted objective picked — an operator who disagrees with the weighting can pick a
        different point off this front, which is why it is shown beside the ranking rather than
        instead of it. Hover any point for its numbers.
      </p>
    </Panel>
  );
}

function MatrixPanel({
  run,
  all,
  onSelect,
}: {
  run: ScenarioRunRow;
  all: ScenarioRunRow[];
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <Panel
      title={`Scenario matrix — ${run.drugLabel}`}
      eyebrow="Stage 6"
      subtitle={`${String(run.scenarios.length)} row(s). The baseline is always present, because every other row is reported as a delta against it.`}
      actions={
        all.length <= 1 ? null : (
          <Select
            value={run.id}
            onChange={onSelect}
            options={all.map((one) => ({
              value: one.id,
              label: `${one.drugLabel} · ${one.createdAt.slice(0, DATETIME_LENGTH).replace('T', ' ')}`,
            }))}
          />
        )
      }
      flush
    >
      <Table
        headers={[
          'Option',
          'Expected shortage',
          'Stock lasts (days)',
          'Back to normal in',
          'Total cost (₹)',
          'Price type',
        ]}
      >
        {run.scenarios.map((scenario) => (
          <Row key={scenario.id} highlighted={scenario.id === run.chosenScenarioId}>
            <Cell>
              <CellStack
                primary={
                  <>
                    {scenario.sourcing.label}
                    {scenario.id === run.chosenScenarioId ? (
                      <span style={{ color: 'var(--vl-accent)' }}> · chosen</span>
                    ) : null}
                    {scenario.isBaseline ? <span className="vl-muted"> · baseline</span> : null}
                  </>
                }
                secondary={
                  scenario.logistics === null
                    ? 'ships nothing'
                    : `${scenario.logistics.carrierDisplay} · ${scenario.logistics.service}`
                }
              />
            </Cell>
            <Cell>
              <QuantityValue quantity={scenario.outcome.expectedShortage} showTag={false} />
            </Cell>
            <Cell>
              <QuantityValue quantity={scenario.outcome.daysOfCoverBand} showTag={false} />
            </Cell>
            <Cell>
              <QuantityValue quantity={scenario.outcome.recoveryDays} />
            </Cell>
            <Cell align="right" nowrap>
              {scenario.outcome.totalCostInr.toLocaleString('en-IN')}
            </Cell>
            <Cell>
              {scenario.outcome.quoteStatusWorst === null ? (
                <span className="vl-muted">—</span>
              ) : (
                <QuoteStatusChip status={scenario.outcome.quoteStatusWorst as QuoteStatus} />
              )}
            </Cell>
          </Row>
        ))}
      </Table>

      <div style={{ padding: '14px 18px 16px' }}>
        {run.truncation === null ? null : <Note tone="warn">{run.truncation}</Note>}
        {run.scenarios[0] === undefined ? null : (
          <UnavailableList fields={run.scenarios[0].outcome.unavailable} />
        )}
      </div>
    </Panel>
  );
}

/** The chosen row, its objective breakdown, and what it gains over doing nothing. */
function ChoicePanel({ run }: { run: ScenarioRunRow }): React.ReactElement {
  const chosen = run.scenarios.find((one) => one.id === run.chosenScenarioId);
  const scored = run.objectiveValues.find((one) => one.scenarioId === run.chosenScenarioId);

  if (chosen === undefined || scored === undefined) {
    return (
      <Panel title="The choice">
        <Empty reason="No scenario was chosen, which means enumeration failed rather than that every option was equally good — the baseline is always a candidate, so its absence is a bug." />
      </Panel>
    );
  }

  const heaviest = Math.max(...scored.breakdown.map((term) => term.contribution), 0);

  return (
    <div className="vl-grid-2">
      <Panel
        title={`Chosen: ${chosen.label}`}
        eyebrow="Stage 7, with an opinion"
        subtitle="The objective is a policy choice, not a derivation. Every term's raw value sits beside its normalised one, because min-max normalisation makes a small absolute spread look decisive."
      >
        <MeterList>
          {scored.breakdown.map((term) => (
            <Meter
              key={term.term}
              label={`${term.term.replaceAll('_', ' ')} · ${(term.weight * PERCENT).toFixed(0)}% weight`}
              value={term.contribution}
              max={heaviest}
              display={term.contribution.toFixed(DECIMALS.objective)}
              tone="scenario"
            />
          ))}
        </MeterList>

        <Table headers={['What we weighed', 'Actual value', 'Scaled 0–1', 'Effect on score']}>
          {scored.breakdown.map((term) => (
            <Row key={term.term}>
              <Cell>
                <code style={{ fontSize: '0.75rem' }}>{term.term}</code>
              </Cell>
              <Cell align="right">{term.raw.toLocaleString('en-IN')}</Cell>
              <Cell align="right">{term.normalised.toFixed(DECIMALS.objective)}</Cell>
              <Cell align="right">{term.contribution.toFixed(DECIMALS.objective)}</Cell>
            </Row>
          ))}
          <Row total>
            <Cell>TOTAL — lower is better</Cell>
            <Cell colSpan={3} align="right">
              {scored.value.toFixed(DECIMALS.objective)}
            </Cell>
          </Row>
        </Table>
      </Panel>

      <Panel
        title="Against the baseline"
        eyebrow="What the choice buys"
        subtitle="Every row is a delta against doing nothing, which is always enumerated as a candidate."
      >
        <Table headers={['Measure', 'Change vs doing nothing']}>
          {Object.entries(run.deltaVsBaseline).map(([field, delta]) => (
            <Row key={field}>
              <Cell>
                <code style={{ fontSize: '0.75rem' }}>{field}</code>
              </Cell>
              <Cell align="right">
                <span style={{ color: delta < 0 ? 'var(--vl-real)' : 'var(--vl-ink)' }}>
                  {delta > 0 ? '+' : ''}
                  {delta.toLocaleString('en-IN')}
                </span>
              </Cell>
            </Row>
          ))}
        </Table>

        <Note tone="accent" title="The weights in force">
          Stored with the answer so the policy can be argued with rather than inferred.
        </Note>
        <Method>
          {Object.entries(run.weights)
            .map(([key, value]) => `${key.padEnd(24)}${value.toFixed(DECIMALS.weight)}`)
            .join('\n')}
        </Method>
        <Method>{run.solverStatus}</Method>
      </Panel>
    </div>
  );
}
