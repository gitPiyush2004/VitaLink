/**
 * Status chips: quote status, eligibility, veracity, and the mock warning.
 *
 * Every one of these exists because a screenshot of this UI could end up in a
 * slide deck, and the chip has to carry its own caveat there. A colour with a
 * legend somewhere else is not a caveat.
 *
 * The one that matters most is `QuoteStatusChip`. Spec 6.4 and 6.15 both say a
 * sandbox or estimated figure may never be presented as a live carrier quote,
 * and the enforcement is in three places: the contract refuses to construct a
 * `LIVE_QUOTE` without an archived payload, CI gate 5 greps the mock adapter for
 * the string, and this chip makes the difference visible on screen.
 *
 * The tone is a class rather than a colour literal so that "sandbox" and
 * "modelled" resolve to the *same* amber as the MODELLED provenance tag. A
 * reader who has learned what amber means on one screen should not have to
 * relearn it on the next.
 */

import type { QuoteStatus } from '@vitalink/contracts';

type Tone = 'real' | 'derived' | 'modelled' | 'scenario' | 'danger' | 'neutral';

type ChipStyle = { tone: Tone; label: string; title: string };

const QUOTE_STATUS: Record<QuoteStatus, ChipStyle> = {
  LIVE_QUOTE: {
    tone: 'real',
    label: 'LIVE QUOTE',
    title:
      'A real quote from the carrier, against real credentials, with the raw response archived. ' +
      'This is a price you could act on.',
  },
  CONTRACT_RATE: {
    tone: 'real',
    label: 'CONTRACT RATE',
    title: 'A rate from a negotiated contract on file. Not a live API quote, but a real price.',
  },
  SANDBOX_QUOTE: {
    tone: 'modelled',
    label: 'SANDBOX',
    title:
      'NOT A REAL PRICE. Returned by a demo environment or by the development mock carrier. ' +
      'The API shape is real; the number is not commercial pricing and must not be quoted to ' +
      'anyone as a carrier price.',
  },
  ESTIMATED: {
    tone: 'modelled',
    label: 'ESTIMATED',
    title:
      'NOT A CARRIER PRICE. Vitalink modelled this from a rate card. The calculation method on ' +
      'the value gives the full formula.',
  },
  UNAVAILABLE: {
    tone: 'danger',
    label: 'NO QUOTE',
    title:
      'This carrier returned no price. The reason is on the row — it is a fact about our ' +
      'integration, not a fact about the carrier.',
  },
};

function Chip({ style }: { style: ChipStyle }): React.ReactElement {
  return (
    <span className={`vl-chip vl-chip--${style.tone}`} title={style.title}>
      {style.label}
    </span>
  );
}

export function QuoteStatusChip({ status }: { status: QuoteStatus }): React.ReactElement {
  return <Chip style={QUOTE_STATUS[status]} />;
}

/**
 * Eligible or not. An ineligible carrier shows this instead of a score.
 *
 * Never a low score: a score would imply the carrier was considered on the
 * merits and lost, when in fact it was eliminated by a hard constraint.
 */
export function EligibilityChip({
  isEligible,
  failureCount,
}: {
  isEligible: boolean;
  failureCount: number;
}): React.ReactElement {
  if (isEligible) {
    return (
      <Chip
        style={{
          tone: 'real',
          label: 'ELIGIBLE',
          title: 'This carrier passed all nine hard constraints and was scored.',
        }}
      />
    );
  }

  return (
    <Chip
      style={{
        tone: 'danger',
        label: 'NOT ELIGIBLE',
        title:
          `Eliminated by ${String(failureCount)} hard constraint(s), listed on this row. A hard ` +
          'constraint eliminates rather than lowering a score: this carrier is not a worse ' +
          'option, it is not an option.',
      }}
    />
  );
}

/**
 * Verified or quarantined, with the independent-source count.
 *
 * The count is on the chip because "verified" alone is not a claim anyone can
 * check, and two independent sources is the entire bar.
 */
export function VeracityChip({
  verified,
  sourceCount,
}: {
  verified: boolean;
  sourceCount: number;
}): React.ReactElement {
  return (
    <Chip
      style={
        verified
          ? {
              tone: 'real',
              label: `VERIFIED · ${String(sourceCount)} SOURCES`,
              title:
                `Corroborated by ${String(sourceCount)} genuinely independent publishers. Two ` +
                'endpoints of one agency count as one — hover the veracity figure for which ' +
                'publishers, by name.',
            }
          : {
              tone: 'modelled',
              label: 'QUARANTINED',
              title:
                'Not published as an alert. The reason is on the row. A quarantine record is a ' +
                'finding about corroboration, not a failure of ingestion.',
            }
      }
    />
  );
}

/** A plain labelled chip, for counts and states that have no dedicated chip. */
export function Tag({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span className={`vl-chip vl-chip--${tone}`} title={title}>
      {children}
    </span>
  );
}

/**
 * The banner shown whenever a screen contains a mock or sandbox figure.
 *
 * Rendered above the content rather than beside it, because the rule it enforces
 * is that a mock price is never *presented* as a carrier quote — and a caveat
 * below the fold is not presented either.
 */
export function MockModeBanner({ providers }: { providers: string[] }): React.ReactElement | null {
  if (providers.length === 0) return null;

  return (
    <div className="vl-note vl-note--warn" style={{ marginBottom: 18 }}>
      <span className="vl-note-title">Not real carrier pricing</span>
      <div>
        {providers.join(', ')} returned sandbox or modelled figures, not commercial quotes. The
        numbers are deterministic and reproducible — there is no random number anywhere in this
        system — but they must not be quoted to anyone as a carrier price.
      </div>
    </div>
  );
}

/**
 * A row of the "this could not be computed" list.
 *
 * Every scenario and every recommendation carries one of these lists, and it is
 * rendered rather than collapsed. The gaps are the most important thing this
 * system says about itself.
 */
export function UnavailableList({
  fields,
}: {
  fields: { field: string; reason: string }[];
}): React.ReactElement | null {
  if (fields.length === 0) return null;

  return (
    <details className="vl-disclosure">
      <summary>
        {fields.length} field(s) could not be computed — and why they are blank rather than zero
      </summary>
      <div className="vl-disclosure-body">
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {fields.map((one) => (
            <li key={one.field}>
              <code style={{ color: 'var(--vl-ink)' }}>{one.field}</code>{' '}
              <span className="vl-muted">— {one.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
