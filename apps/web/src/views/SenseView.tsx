/**
 * Stages 1–2: SENSE and VERIFY.
 *
 * The panel order is the argument. Alerts first, because that is what an
 * operator wants — then **quarantine**, because the honest headline of this
 * stage is how much of what the system sees it cannot corroborate. On a live run
 * that was 123 of 123 clusters, and a UI that showed only the alerts would have
 * displayed an empty list and said nothing.
 *
 * Each panel is its own component rather than a block inside one long return.
 * That is not only for readability: every one of them has three states — error,
 * empty-with-a-reason, and data — and holding nine ternaries in one function put
 * it past the complexity budget for a reason.
 */

import {
  Button,
  Cell,
  CellStack,
  Disclosure,
  Empty,
  ErrorNote,
  Meter,
  MeterList,
  Method,
  Note,
  Panel,
  QuantityValue,
  Row,
  Stat,
  StatGrid,
  Table,
  VeracityChip,
} from '@vitalink/ui';

import { quarantinedTotal } from '../api/overview';
import {
  listAlerts,
  listQuarantine,
  listSignals,
  quarantineSummary,
  runIngest,
  runVerify,
  type AlertRow,
  type IngestOutcome,
  type QuarantineRow,
  type SignalRow,
  type VerifyOutcome,
} from '../api/queries';

import type { ViewProps } from './types';
import { useAction, useApi, type ApiState } from './useApi';

const QUARANTINE_ROWS = 12;
const SIGNAL_ROWS = 25;
/** `YYYY-MM-DD` off the front of an ISO instant. */
const DATE_LENGTH = 10;

export function SenseView({ reloadOverview }: ViewProps): React.ReactElement {
  const alerts = useApi(() => listAlerts(), []);
  const quarantine = useApi(() => listQuarantine(), []);
  const summary = useApi(() => quarantineSummary(), []);
  const signals = useApi(() => listSignals(), []);

  const ingest = useAction<IngestOutcome>();
  const verify = useAction<VerifyOutcome>();

  function reloadAll(): void {
    alerts.reload();
    quarantine.reload();
    summary.reload();
    signals.reload();
    reloadOverview();
  }

  const held = summary.data === null ? 0 : quarantinedTotal(summary.data);
  const relevant = signals.data?.filter((one) => one.isPharmaSupplyRelevant).length ?? 0;

  return (
    <>
      <StatGrid>
        <Stat
          label="Signals stored"
          value={signals.data?.length ?? '—'}
          note={`${String(relevant)} passed the pharma-relevance test`}
          tone="real"
        />
        <Stat
          label="Alerts published"
          value={alerts.data?.length ?? '—'}
          note="two genuinely independent publishers agreed"
          tone={alerts.data?.length === 0 ? 'modelled' : 'real'}
        />
        <Stat
          label="Held in quarantine"
          value={held}
          note="kept with the rule that rejected them"
          tone="modelled"
        />
        <Stat
          label="Independence rule"
          value="2 sources"
          note="two endpoints of one agency count as one"
          tone="derived"
        />
      </StatGrid>

      <Panel
        title="Run the loop's first two stages"
        eyebrow="Stages 1 and 2"
        subtitle="SENSE pulls three live sources. VERIFY clusters them, asks a second source for corroboration, and publishes only what two independent publishers agree on."
        actions={
          <>
            <Button
              onClick={() => {
                ingest.run(async () => {
                  const outcome = await runIngest();
                  reloadAll();
                  return outcome;
                });
              }}
              busy={ingest.busy}
            >
              {ingest.busy ? 'Pulling sources…' : 'Run SENSE'}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                verify.run(async () => {
                  const outcome = await runVerify();
                  reloadAll();
                  return outcome;
                });
              }}
              busy={verify.busy}
            >
              {verify.busy ? 'Verifying…' : 'Run VERIFY'}
            </Button>
          </>
        }
      >
        {ingest.error === null ? null : <ErrorNote text={ingest.error} />}
        {ingest.result === null ? null : <IngestReport outcome={ingest.result} />}
        {verify.error === null ? null : <ErrorNote text={verify.error} />}
        {verify.result === null ? null : <VerifyReport outcome={verify.result} />}
        {ingest.result === null && verify.result === null ? (
          <Empty reason="Nothing has been run in this session — the tables below show what is already stored. VERIFY takes up to a minute: GDELT enforces one request every five seconds and answers a 30-day query in about twenty." />
        ) : null}
      </Panel>

      <AlertsPanel alerts={alerts} />
      <QuarantinePanel summary={summary} quarantine={quarantine} held={held} />
      <SignalsPanel signals={signals} />
    </>
  );
}

/** A panel body that is a table, an error, or a reasoned empty state. */
function PanelState({
  error,
  empty,
  isEmpty,
  children,
}: {
  error: string | null;
  empty: string;
  isEmpty: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  if (error !== null) {
    return (
      <div style={{ padding: 18 }}>
        <ErrorNote text={error} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: 18 }}>
        <Empty reason={empty} />
      </div>
    );
  }

  return <>{children}</>;
}

function AlertsPanel({ alerts }: { alerts: ApiState<AlertRow[]> }): React.ReactElement {
  const rows = alerts.data ?? [];

  return (
    <Panel
      title="Verified alerts"
      eyebrow="Stage 2 output"
      subtitle="Published only where two genuinely independent publishers agree."
      flush
    >
      <PanelState
        error={alerts.error}
        isEmpty={rows.length === 0}
        empty="No alert has cleared the two-independent-sources rule. That is a finding rather than an empty screen: an FDA recall that only the FDA reported cannot be corroborated, and the quarantine panel below says exactly how often that happened."
      >
        <Table headers={['What happened', 'Severity', 'Trust score', 'Matched to', 'Status']}>
          {rows.map((alert) => (
            <Row key={alert.id}>
              <Cell>
                <CellStack
                  primary={alert.category}
                  secondary={
                    <>
                      {alert.insight}
                      {alert.manufacturer === null ? null : <> · {alert.manufacturer}</>}
                    </>
                  }
                />
              </Cell>
              <Cell align="right" nowrap>
                {alert.severity} / 5
              </Cell>
              <Cell>
                <QuantityValue quantity={alert.veracity} />
              </Cell>
              <Cell>
                {alert.resolvedNodeId === null ? (
                  <span className="vl-unavailable" title={alert.resolutionBasis}>
                    unresolved — why?
                  </span>
                ) : (
                  <code style={{ fontSize: '0.75rem' }} title={alert.resolutionBasis}>
                    {alert.resolvedNodeId}
                  </code>
                )}
              </Cell>
              <Cell>
                <VeracityChip
                  verified={alert.verified}
                  sourceCount={alert.independentSourceCount}
                />
              </Cell>
            </Row>
          ))}
        </Table>
      </PanelState>
    </Panel>
  );
}

function QuarantinePanel({
  summary,
  quarantine,
  held,
}: {
  summary: ApiState<Record<string, number>>;
  quarantine: ApiState<QuarantineRow[]>;
  held: number;
}): React.ReactElement {
  const reasons = Object.entries(summary.data ?? {});
  const rows = quarantine.data ?? [];

  return (
    <Panel
      title="Quarantine"
      eyebrow="What we saw and could not stand behind"
      subtitle="Not a failure log. Every row is a real story that failed corroboration, kept with the reason so the rule that rejected it can be audited."
    >
      <PanelState
        error={summary.error}
        isEmpty={reasons.length === 0}
        empty="Nothing in quarantine yet. Run VERIFY above."
      >
        <MeterList>
          {reasons.map(([reason, count]) => (
            <Meter
              key={reason}
              label={reason.replaceAll('_', ' ')}
              value={count}
              max={held}
              display={String(count)}
              tone="modelled"
            />
          ))}
        </MeterList>

        <Note tone="warn" title="How to read these">
          <strong>insufficient_independent_sources</strong> means one publisher reported it, or
          nobody looked — the row says which. <strong>not_pharma_relevant</strong> means a keyword
          test rejected it; the decision is recorded per signal, so a wrong rejection is reviewable
          rather than invisible.
        </Note>

        {rows.length === 0 ? null : (
          <Disclosure summary={`The ${String(QUARANTINE_ROWS)} most recent, row by row`}>
            <Table headers={['Why it was held', 'What the report said', 'Trust score', 'Detail']}>
              {rows.slice(0, QUARANTINE_ROWS).map((row) => (
                <Row key={row.id}>
                  <Cell>
                    <code style={{ fontSize: '0.72rem' }}>{row.reason}</code>
                  </Cell>
                  <Cell>{row.extraction?.insight ?? '(no extraction)'}</Cell>
                  <Cell>
                    <QuantityValue quantity={row.veracity} />
                  </Cell>
                  <Cell>
                    <span className="vl-muted">{row.detail}</span>
                  </Cell>
                </Row>
              ))}
            </Table>
          </Disclosure>
        )}
      </PanelState>
    </Panel>
  );
}

function SignalsPanel({ signals }: { signals: ApiState<SignalRow[]> }): React.ReactElement {
  const rows = signals.data ?? [];

  return (
    <Panel
      title="Raw signals"
      eyebrow="Stage 1 output"
      subtitle="Stored exactly as the source published them, never rewritten. The extraction method says whether the structured fields were read from the source or matched from a headline."
      flush
    >
      <PanelState
        error={signals.error}
        isEmpty={rows.length === 0}
        empty="No signals in the last 30 days. Run SENSE above."
      >
        <Table headers={['Source', 'Published', 'Headline', 'How we read it', 'Pharma-relevant?']}>
          {rows.slice(0, SIGNAL_ROWS).map((signal) => (
            <Row key={signal.id}>
              <Cell nowrap>
                <code style={{ fontSize: '0.72rem' }}>{signal.source}</code>
              </Cell>
              <Cell nowrap>{signal.publishedAt.slice(0, DATE_LENGTH)}</Cell>
              <Cell>
                <a href={signal.url} target="_blank" rel="noreferrer noopener">
                  {signal.title}
                </a>
              </Cell>
              <Cell nowrap>
                <span
                  title={`${signal.extractionBasis}\n\nSeverity basis: ${signal.severityBasis}`}
                  style={{ cursor: 'help', fontSize: '0.72rem' }}
                >
                  <code>{signal.extractionMethod}</code>
                </span>
              </Cell>
              <Cell nowrap>{signal.isPharmaSupplyRelevant ? 'yes' : 'no'}</Cell>
            </Row>
          ))}
        </Table>
      </PanelState>
    </Panel>
  );
}

/** Per source: what came back, and what was skipped. Skipping is never silent. */
function IngestReport({ outcome }: { outcome: IngestOutcome }): React.ReactElement {
  return (
    <div style={{ marginBottom: 12 }}>
      <Table headers={['Source', 'Fetched', 'Stored', 'Skipped']}>
        {outcome.perSource.map((source) => (
          <Row key={source.source}>
            <Cell>
              <code style={{ fontSize: '0.75rem' }}>{source.source}</code>
            </Cell>
            <Cell align="right">{source.fetched}</Cell>
            <Cell align="right">{source.stored}</Cell>
            <Cell>
              {source.skipped.length === 0 ? (
                <span className="vl-muted">none</span>
              ) : (
                <span title={source.skipped.join('\n\n')} style={{ cursor: 'help' }}>
                  {source.skipped.length} — why?
                </span>
              )}
            </Cell>
          </Row>
        ))}
        {outcome.sourceFailures.map((failure) => (
          <Row key={failure.source}>
            <Cell>
              <code style={{ fontSize: '0.75rem' }}>{failure.source}</code>
            </Cell>
            <Cell colSpan={3}>
              <span className="vl-danger">unreachable — {failure.error}</span>
            </Cell>
          </Row>
        ))}
      </Table>
      <p className="vl-chart-caption">
        {outcome.signalsStored} signal(s) written or updated. Re-running is idempotent: ids are
        derived from the source&apos;s own identifier, so polling one feed twice cannot produce two
        signals that then corroborate each other.
      </p>
    </div>
  );
}

function VerifyReport({ outcome }: { outcome: VerifyOutcome }): React.ReactElement {
  return (
    <div>
      <Note tone="accent" title="Verify finished">
        {outcome.corroborationRate}
        <br />
        <span className="vl-muted">
          {outcome.corroborationBudget.used} of {outcome.corroborationBudget.limit} corroboration
          queries spent. {outcome.corroborationBudget.note}
        </span>
      </Note>
      {Object.keys(outcome.byQuarantineReason).length === 0 ? null : (
        <Method>
          {Object.entries(outcome.byQuarantineReason)
            .map(([reason, count]) => `${String(count).padStart(4)}  ${reason}`)
            .join('\n')}
        </Method>
      )}
    </div>
  );
}
