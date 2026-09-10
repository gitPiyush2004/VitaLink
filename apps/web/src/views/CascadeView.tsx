/**
 * Stages 4–5: TRACE and QUANTIFY.
 *
 * The propagation path is the panel that justifies the whole system. "This drug
 * is at risk" is a claim; "this drug is at risk because this ingredient is in
 * it, and only two firms make that ingredient" is a claim someone can check —
 * and only the second can be acted on or argued with.
 *
 * So the path renders as a literal chain of hops, with the edge weight on each,
 * rather than as a score with a tooltip. The cover projection renders as a band
 * for the same reason in the other direction: it is MODELLED, and a centre line
 * would invite a reader to read a precision the model does not have.
 */

import { useState } from 'react';

import {
  BandChart,
  Button,
  Cell,
  CellStack,
  Empty,
  ErrorNote,
  Method,
  Note,
  Panel,
  Pill,
  QuantityValue,
  Row,
  Stat,
  StatGrid,
  Table,
  TextField,
  Toolbar,
} from '@vitalink/ui';

import {
  getCascade,
  listCascades,
  runCascade,
  type CascadeRow,
  type ExposedDrug,
} from '../api/queries';

import type { ViewProps } from './types';
import { useAction, useApi } from './useApi';

/** The default shock for a demo: a real ingredient node in the live graph. */
const DEFAULT_SHOCK = 'ingredient:heparin-sodium';
const DEFAULT_DURATION_DAYS = 90;
const DEFAULT_COVER_DAYS = 30;
const TOP_DRUGS = 6;
const MAX_PATHS = 4;
const PERCENT = 100;

export function CascadeView({ reloadOverview }: ViewProps): React.ReactElement {
  const cascades = useApi(() => listCascades(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shockNode, setShockNode] = useState(DEFAULT_SHOCK);
  const [coverDays, setCoverDays] = useState(String(DEFAULT_COVER_DAYS));

  const run = useAction<CascadeRow>();
  const selected = useApi(
    async () => (selectedId === null ? null : getCascade(selectedId)),
    [selectedId],
  );

  const shown = run.result ?? selected.data ?? cascades.data?.[0] ?? null;
  const worst = shown?.exposedDrugs[0];

  return (
    <>
      <StatGrid>
        <Stat
          label="Drugs reached"
          value={shown?.exposedDrugs.length ?? '—'}
          note={
            shown === null
              ? 'no cascade run yet'
              : `across ${String(shown.touchedNodeIds.length)} graph nodes`
          }
          tone="derived"
        />
        <Stat
          label="Highest exposure"
          value={
            worst === undefined ? '—' : `${(worst.exposureQuantity.value * PERCENT).toFixed(1)}%`
          }
          note={worst?.label ?? 'nothing exposed'}
          tone="modelled"
        />
        <Stat
          label="Paths pruned"
          value={
            shown === null
              ? '—'
              : shown.traversalNotes.pathsPrunedByWeight + shown.traversalNotes.pathsPrunedByCap
          }
          note="reported rather than silent"
          tone="neutral"
        />
        <Stat
          label="Facilities affected"
          unavailable="No geocoded facilities exist in this build. The physical layer is not implemented, so this is absent rather than estimated as zero."
          note="needs the physical layer"
          tone="danger"
        />
      </StatGrid>

      <Panel
        title="Run a cascade"
        eyebrow="Stage 4"
        subtitle="Pins a shock to one node and propagates forward along supply flow, accumulating exposure over every path."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              run.run(async () => {
                const cascade = await runCascade({
                  shock_node_id: shockNode,
                  alert_id: null,
                  duration_days: DEFAULT_DURATION_DAYS,
                  assumed_cover_days: Number(coverDays),
                });
                cascades.reload();
                reloadOverview();
                return cascade;
              });
            }}
            busy={run.busy}
            disabled={shockNode === '' || coverDays === ''}
          >
            {run.busy ? 'Tracing…' : 'Run cascade'}
          </Button>
        }
      >
        <Toolbar>
          <TextField
            label="What has stopped"
            value={shockNode}
            onChange={setShockNode}
            width={320}
            hint="An ingredient or a manufacturer, by its id in the graph."
          />
          <TextField
            label="Days of stock you hold today"
            value={coverDays}
            onChange={setCoverDays}
            width={240}
            hint="Your figure, not ours — no public source publishes inventory, so this is tagged SCENARIO and has no default."
          />
        </Toolbar>

        {run.error === null ? null : (
          <div style={{ marginTop: 14 }}>
            <ErrorNote text={run.error} />
          </div>
        )}

        {cascades.data === null || cascades.data.length === 0 ? null : (
          <div className="vl-pills" style={{ marginTop: 16 }}>
            {cascades.data.map((cascade) => (
              <Pill
                key={cascade.id}
                active={shown?.id === cascade.id}
                onClick={() => {
                  run.clear();
                  setSelectedId(cascade.id);
                }}
              >
                {cascade.request.shockNodeId} · {cascade.request.assumedCoverDays}d cover
              </Pill>
            ))}
          </div>
        )}
      </Panel>

      {shown === null ? (
        <Panel title="Exposed drugs">
          <Empty reason="No cascade has been run yet. A cascade that reaches no drug is also a finding — an isolated node — and the API says so rather than showing an empty list that looks like no risk." />
        </Panel>
      ) : (
        <>
          <Panel
            title={`Exposed drugs — ${shown.request.shockNodeId}`}
            eyebrow="Stage 4 output"
            subtitle={`${String(shown.exposedDrugs.length)} drug(s) reached. ${String(shown.traversalNotes.pathsPrunedByWeight)} path(s) pruned by weight, ${String(shown.traversalNotes.pathsPrunedByCap)} by the per-drug cap.`}
            flush
          >
            <Table
              headers={[
                'Medicine',
                'How badly affected',
                'Stock will last',
                'Runs out around',
                'Routes',
              ]}
            >
              {shown.exposedDrugs.slice(0, TOP_DRUGS).map((drug) => (
                <Row key={drug.drugId}>
                  <Cell>
                    <CellStack primary={drug.label} secondary={<code>{drug.drugId}</code>} />
                  </Cell>
                  <Cell>
                    <QuantityValue quantity={drug.exposureQuantity} />
                    <span className="vl-cell-sub">
                      {(drug.exposureQuantity.value * PERCENT).toFixed(1)}% of the shock reaches it
                    </span>
                  </Cell>
                  <Cell>
                    <QuantityValue quantity={drug.coverBandDays} />
                  </Cell>
                  <Cell nowrap>
                    {drug.coverProjection.stockoutDayBand === null ? (
                      <span className="vl-muted">beyond the 90-day horizon</span>
                    ) : (
                      <>
                        day {drug.coverProjection.stockoutDayBand.low}–
                        {drug.coverProjection.stockoutDayBand.high}
                      </>
                    )}
                  </Cell>
                  <Cell align="right">{drug.propagationPaths.length}</Cell>
                </Row>
              ))}
            </Table>
          </Panel>

          {worst === undefined ? null : (
            <>
              <CoverPanel drug={worst} />
              <PathPanel drug={worst} />
            </>
          )}
        </>
      )}
    </>
  );
}

/**
 * Days of cover over the horizon, drawn as the band it is stored as.
 *
 * There is deliberately no centre line. The projection is MODELLED, the schema
 * refuses to store it as a point, and drawing one here would put the false
 * precision straight back — an eye follows a line and ignores the shading.
 */
function CoverPanel({ drug }: { drug: ExposedDrug }): React.ReactElement {
  const { coverProjection } = drug;

  return (
    <Panel
      title={`Days of cover — ${drug.label}`}
      eyebrow="Stage 5"
      subtitle="A sensitivity range, not a confidence interval: the width comes from the operator's assumed cover, not from a fitted distribution."
    >
      <BandChart
        days={coverProjection.days}
        low={coverProjection.coverLow}
        high={coverProjection.coverHigh}
        stockoutBand={coverProjection.stockoutDayBand}
        yLabel="days of cover"
      />
      <p className="vl-chart-caption">
        {coverProjection.stockoutDayBand === null
          ? 'Cover does not reach zero inside the 90-day horizon under either edge of the band.'
          : `The shaded column is where cover reaches zero: somewhere between day ${String(coverProjection.stockoutDayBand.low)} and day ${String(coverProjection.stockoutDayBand.high)}, depending on which edge of the assumption holds.`}
      </p>

      <Note tone="warn" title="Three inputs this stage does not have">
        Inventory, incoming supply and demand are all unpublished. Days of cover at t0 is therefore
        a SCENARIO input with no default — the operator knows it and no API does — and everything
        drawn above inherits that assumption.
      </Note>

      <Method>{coverProjection.calculationMethod}</Method>
    </Panel>
  );
}

/**
 * The propagation chain for the most exposed drug, hop by hop.
 *
 * This is the panel that makes the exposure score checkable. Without it the
 * number is an assertion; with it, a reader can follow the chain and disagree
 * with a specific edge.
 */
function PathPanel({ drug }: { drug: ExposedDrug }): React.ReactElement {
  return (
    <Panel
      title={`How the shock reaches ${drug.label}`}
      eyebrow="Every path, hop by hop"
      subtitle="The exposure score is the decayed sum over these paths, so a reader who disagrees with the score can point at the edge they disagree with."
    >
      {drug.propagationPaths.length === 0 ? (
        <Empty reason="No path was recorded, which should not happen for an exposed drug and is worth reporting as a bug." />
      ) : (
        <>
          {drug.propagationPaths.slice(0, MAX_PATHS).map((path, index) => (
            // Paths have no id of their own; the index is stable within one render.
            <div className="vl-path" key={index}>
              <div className="vl-path-meta">
                path weight {path.pathWeight.toFixed(4)} · {path.length} hop(s)
              </div>
              <div className="vl-hops">
                {path.hops.map((hop, hopIndex) => (
                  <span
                    key={`${hop.fromLabel}-${hop.toLabel}-${String(hopIndex)}`}
                    className="vl-hops"
                    style={{ gap: 6 }}
                  >
                    {hopIndex === 0 ? (
                      <span className="vl-hop vl-hop--origin">{hop.fromLabel}</span>
                    ) : null}
                    <span className="vl-hop-edge">
                      {hop.rel} <span style={{ opacity: 0.7 }}>×{hop.weight.toFixed(2)}</span> →
                    </span>
                    <span
                      className={
                        hopIndex === path.hops.length - 1 ? 'vl-hop vl-hop--target' : 'vl-hop'
                      }
                    >
                      {hop.toLabel}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          <Method>{drug.exposureQuantity.provenance.calculation_method ?? '(none stored)'}</Method>
        </>
      )}
    </Panel>
  );
}
