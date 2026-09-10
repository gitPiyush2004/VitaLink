/**
 * Stage 8: EXECUTE — the carrier comparison.
 *
 * Three things this screen must get right, all of them about honesty rather
 * than layout.
 *
 * **Every carrier attempted appears**, including the ones that returned nothing.
 * A table showing one price reads as "there is one option"; the truth is "there
 * is one option we can see", and the coverage note says so in words.
 *
 * **An ineligible carrier shows no score.** A low score would imply it was
 * considered on the merits and lost. It was eliminated by a hard constraint, and
 * the constraint is named on the row.
 *
 * **A sandbox figure is chipped as one, above the fold.** The banner is rendered
 * before the table rather than under it, because the rule is that a mock price
 * is never *presented* as a carrier quote — and a caveat below the fold is not
 * presented either.
 */

import { useState } from 'react';

import type { CarrierQuote } from '@vitalink/contracts';
import {
  Cell,
  CellStack,
  Disclosure,
  EligibilityChip,
  Empty,
  ErrorNote,
  Meter,
  MeterList,
  Method,
  MockModeBanner,
  Note,
  Panel,
  QuantityValue,
  QuoteStatusChip,
  Row,
  Select,
  Stat,
  StatGrid,
  Table,
} from '@vitalink/ui';

import {
  listCarriers,
  listRecommendations,
  listShipments,
  type CarrierRow,
  type RecommendationRow,
  type ShipmentRow,
} from '../api/queries';

import { useApi } from './useApi';

const PERCENT = 100;
const SCORE_DECIMALS = 1;
const DATETIME_LENGTH = 16;
const MAX_SUB_SCORE = 100;

export function LogisticsView(): React.ReactElement {
  const recommendations = useApi(() => listRecommendations(), []);
  const shipments = useApi(() => listShipments(), []);
  const carriers = useApi(() => listCarriers(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown =
    recommendations.data?.find((one) => one.id === selectedId) ?? recommendations.data?.[0] ?? null;
  const shipment = shipments.data?.find((one) => one.request.id === shown?.shipmentRequestId);
  const decision = shown?.recommendation;
  const eligible = decision?.eligibility.filter((one) => one.result.isEligible).length ?? 0;

  return (
    <>
      <StatGrid>
        <Stat
          label="Carriers attempted"
          value={decision?.carriersAttempted ?? carriers.data?.length ?? '—'}
          note="every one appears in the table, quoting or not"
          tone="derived"
        />
        <Stat
          label="Returned a price"
          value={decision?.carriersQuoted ?? '—'}
          note="the rest carry the verified reason they cannot"
          tone="real"
        />
        <Stat
          label="Passed all nine constraints"
          value={eligible}
          note="a hard constraint eliminates rather than lowering a score"
          tone={eligible === 0 ? 'modelled' : 'real'}
        />
        <Stat
          label="Carrier reliability data"
          unavailable="Stage 9 is not built, so there is no tracking history and no on-time rate. The reliability sub-score stays neutral rather than inventing one."
          note="the sub-score is neutral for everyone"
          tone="danger"
        />
      </StatGrid>

      {shipment === undefined ? null : <ConstraintsPanel shipment={shipment} />}

      {shown === null ? (
        <Panel title="Carrier comparison" eyebrow="Stage 8">
          {recommendations.error === null ? (
            <Empty reason="No recommendation stored yet. Run: npm run recommend --workspace @vitalink/api -- <cascade-id> <drug-id> <weight-kg>" />
          ) : (
            <ErrorNote text={recommendations.error} />
          )}
        </Panel>
      ) : (
        <ComparisonPanel
          recommendation={shown}
          all={recommendations.data ?? []}
          onSelect={setSelectedId}
        />
      )}

      <CoveragePanel carriers={carriers.data} />
    </>
  );
}

/**
 * What the shipment's constraints are, and where each one came from.
 *
 * The third column is the point of the panel: it is the "zero manual input"
 * claim made checkable, field by field.
 */
function ConstraintsPanel({ shipment }: { shipment: ShipmentRow }): React.ReactElement {
  const { request } = shipment;

  const rows = [
    ['Temperature', request.temperature_requirement, "the drug's openFDA label, parsed"],
    [
      'Forbidden ranges',
      shipment.prohibitedRanges.length === 0 ? 'none stated' : shipment.prohibitedRanges.join(', '),
      'the same label — a carrier whose only service is a forbidden range is eliminated',
    ],
    ['Deadline', request.required_delivery_deadline, 'cover band, minus a receiving and QC margin'],
    ['Urgency', request.urgency, 'the LOW edge of the cover band, not the midpoint'],
    ['Handling', request.special_handling.join(', '), 'GDP is unconditional for a pharmaceutical'],
  ];

  return (
    <Panel
      title={`Shipment constraints — ${request.product.name}`}
      eyebrow={`${request.origin.city} → ${request.destination.city}`}
      subtitle="Every constraint below was derived from the drug's own label and the cascade's cover band. None of them was asked of the operator."
      flush
    >
      <Table headers={['Requirement', 'Value', 'Where it came from']}>
        {rows.map(([label, value, origin]) => (
          <Row key={label}>
            <Cell nowrap>{label}</Cell>
            <Cell>
              <span className="vl-cell-strong">{value}</span>
            </Cell>
            <Cell>
              <span className="vl-muted">{origin}</span>
            </Cell>
          </Row>
        ))}
        <Row>
          <Cell nowrap>Weight</Cell>
          <Cell>
            <QuantityValue quantity={request.weight_kg} />
          </Cell>
          <Cell>
            <span className="vl-muted">
              the operator — no public source states how much of a drug a facility needs
            </span>
          </Cell>
        </Row>
      </Table>

      <div style={{ padding: '14px 18px 16px' }}>
        <Disclosure summary="The full derivation, step by step">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {shipment.derivation.map((line, index) => (
              // Derivation lines have no id; the index is stable per render.
              <li key={index}>{line}</li>
            ))}
          </ol>
        </Disclosure>
      </div>
    </Panel>
  );
}

/** One carrier's row: a score if it was eligible, a chip and reasons if not. */
function ComparisonRow({
  row,
  quote,
  scored,
}: {
  row: RecommendationRow['recommendation']['eligibility'][number];
  quote: CarrierQuote | undefined;
  scored: RecommendationRow['recommendation']['scored'][number] | undefined;
}): React.ReactElement {
  const price = quote === undefined || quote.price === null ? null : quote.price;

  return (
    <Row highlighted={scored !== undefined && scored.finalScore > 0 && row.result.isEligible}>
      <Cell>
        <CellStack primary={quote?.provider_display ?? row.carrierId} secondary={quote?.service} />
      </Cell>

      <Cell align="right" nowrap>
        {price === null ? (
          <span className="vl-muted">—</span>
        ) : (
          <QuantityValue quantity={price} showTag={false} />
        )}
      </Cell>

      <Cell>
        <QuoteStatusChip status={quote?.quote_status ?? 'UNAVAILABLE'} />
      </Cell>

      <Cell align="right">
        {row.result.isEligible && scored !== undefined ? (
          <strong style={{ color: 'var(--vl-accent)', fontSize: '1rem' }}>
            {scored.finalScore.toFixed(SCORE_DECIMALS)}
          </strong>
        ) : (
          <EligibilityChip
            isEligible={row.result.isEligible}
            failureCount={row.result.failures.length}
          />
        )}
      </Cell>

      <Cell>
        {row.result.failures.length === 0 ? (
          <span className="vl-muted">—</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 15, fontSize: '0.75rem', lineHeight: 1.7 }}>
            {row.result.failures.map((failure) => (
              <li key={failure.reason} title={failure.detail} style={{ cursor: 'help' }}>
                <code>{failure.reason}</code>
              </li>
            ))}
          </ul>
        )}
      </Cell>
    </Row>
  );
}

function ComparisonPanel({
  recommendation,
  all,
  onSelect,
}: {
  recommendation: RecommendationRow;
  all: RecommendationRow[];
  onSelect: (id: string) => void;
}): React.ReactElement {
  const { recommendation: decision, quotes } = recommendation;
  const scoredByQuote = new Map(decision.scored.map((one) => [one.quoteId, one]));
  const quoteById = new Map(quotes.map((one) => [one.id, one]));

  // Any provider whose quote is not a real price. Drives the banner above.
  const notRealPricing = [
    ...new Set(
      quotes
        .filter(
          (quote) => quote.quote_status === 'SANDBOX_QUOTE' || quote.quote_status === 'ESTIMATED',
        )
        .map((quote) => quote.provider_display),
    ),
  ];

  const winner = decision.scored[0];

  return (
    <>
      <MockModeBanner providers={notRealPricing} />

      <Panel
        title="Carrier comparison"
        eyebrow="Stage 8 — the gate runs before the score"
        subtitle={recommendation.coverageNote}
        actions={
          all.length <= 1 ? null : (
            <Select
              value={recommendation.id}
              onChange={onSelect}
              options={all.map((one) => ({
                value: one.id,
                label: one.createdAt.slice(0, DATETIME_LENGTH).replace('T', ' '),
              }))}
            />
          )
        }
        flush
      >
        <Table
          headers={['Courier', 'Price', 'Price type', 'Score or verdict', 'Why it was ruled out']}
        >
          {decision.eligibility.map((row) => (
            <ComparisonRow
              key={row.quoteId}
              row={row}
              quote={quoteById.get(row.quoteId)}
              scored={scoredByQuote.get(row.quoteId)}
            />
          ))}
        </Table>

        {decision.counterfactual === null ? null : (
          <div style={{ padding: '14px 18px 16px' }}>
            <Note tone="accent" title="Counterfactual">
              {decision.counterfactual.verdict}
            </Note>
          </div>
        )}
      </Panel>

      {winner === undefined ? (
        <Panel title="Score breakdown">
          <Empty reason="No carrier was eligible, so nothing was scored. That is an answer — 'no carrier can hold this temperature to this destination by this deadline' — and not an error." />
        </Panel>
      ) : (
        <ScorePanel recommendation={recommendation} winner={winner} />
      )}
    </>
  );
}

function ScorePanel({
  recommendation,
  winner,
}: {
  recommendation: RecommendationRow;
  winner: RecommendationRow['recommendation']['scored'][number];
}): React.ReactElement {
  const { profile } = recommendation.recommendation;

  return (
    <Panel
      title={`Score breakdown — ${winner.carrierDisplay}`}
      eyebrow={`Weight profile: ${profile.name}`}
      subtitle={profile.rationale}
    >
      <MeterList>
        {winner.subScores.map((sub) => (
          <Meter
            key={sub.key}
            label={
              <>
                {sub.key.replaceAll('_', ' ')}{' '}
                <span className="vl-muted">· {(sub.weight * PERCENT).toFixed(0)}% weight</span>
                {sub.neutralFallbackReason === null ? null : (
                  <span
                    style={{ color: 'var(--vl-modelled)', cursor: 'help' }}
                    title={sub.neutralFallbackReason}
                  >
                    {' '}
                    · neutral fallback — why?
                  </span>
                )}
              </>
            }
            value={sub.value}
            max={MAX_SUB_SCORE}
            display={`${sub.value.toFixed(0)} → ${sub.contribution.toFixed(SCORE_DECIMALS)}`}
            tone={sub.neutralFallbackReason === null ? 'accent' : 'modelled'}
          />
        ))}
      </MeterList>

      <div className="vl-row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
        <span>
          <span className="vl-label">Final score</span>
          <div style={{ fontSize: '1.875rem', fontWeight: 620, color: 'var(--vl-ink)' }}>
            {winner.finalScore.toFixed(SCORE_DECIMALS)}
          </div>
        </span>
        <span style={{ maxWidth: '52ch', fontSize: '0.8125rem' }}>
          {winner.preferenceNote === null ? (
            <span className="vl-muted">
              No operator preference was applied. A preference breaks ties on merit rather than
              reversing them — and it is disclosed here whenever it fires.
            </span>
          ) : (
            <span style={{ color: 'var(--vl-scenario)' }}>{winner.preferenceNote}</span>
          )}
        </span>
      </div>

      <Disclosure summary="Why this weighting is in force">
        <Method>{recommendation.weightProfile.selectedBecause}</Method>
      </Disclosure>
    </Panel>
  );
}

/**
 * Why there is one price in the table and not six.
 *
 * Each note is what was actually found when that carrier's developer portal was
 * checked, with the date in `docs/CARRIER_STATUS.md`.
 */
function CoveragePanel({ carriers }: { carriers: CarrierRow[] | null }): React.ReactElement {
  return (
    <Panel
      title="Carrier coverage"
      eyebrow="One option, or one option we can see"
      subtitle="Every carrier Vitalink attempts, and the verified reason each one can or cannot return a quote."
      flush
    >
      {carriers === null ? (
        <div style={{ padding: 18 }}>
          <Empty reason="Loading the carrier roster." />
        </div>
      ) : (
        <Table headers={['Courier', 'Tier', 'Account', 'Can it give us a price?']}>
          {carriers.map((carrier) => (
            <Row key={carrier.id}>
              <Cell>
                <span className="vl-cell-strong">{carrier.displayName}</span>
              </Cell>
              <Cell nowrap>{carrier.tier}</Cell>
              <Cell nowrap>{carrier.isConfigured ? 'configured' : 'not configured'}</Cell>
              <Cell>
                <span className="vl-muted">{describeCoverage(carrier)}</span>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

/** The Tier C carriers carry their own note; DSV's depends on its credentials. */
function describeCoverage(carrier: CarrierRow): string {
  if (carrier.integrationNote !== '') return carrier.integrationNote;

  return carrier.isConfigured
    ? 'It can — this is the one Tier A integration, and it has credentials.'
    : 'No credentials in this environment, so it returns NO QUOTE with that reason rather ' +
        'than being hidden from the table.';
}
