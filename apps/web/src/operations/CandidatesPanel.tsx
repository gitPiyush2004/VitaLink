import { useMemo, useState } from 'react';

import type { CandidateAttribute, CandidateSet, ProductCandidate } from '@vitalink/contracts';

const ATTRIBUTE_LABELS: Record<CandidateAttribute['attribute'], string> = {
  ingredients: 'INGREDIENTS',
  strength: 'STRENGTH',
  dosageForm: 'FORM',
  route: 'ROUTE',
  marketingCategory: 'CATEGORY',
};

/**
 * The five attribute verdicts as one glyph.
 *
 * The analyst's first question is "how close is this?", and five coloured
 * segments answer it before any text is read. Each segment keeps its own
 * identity — there is deliberately no total, because a candidate matching four
 * attributes with the fifth unknown is not "80% right".
 */
function Signature({ attributes }: { attributes: CandidateAttribute[] }): React.ReactElement {
  return (
    <div className="cx-sig" aria-hidden>
      {attributes.map((one) => (
        <i key={one.attribute} className={`cx-seg ${one.verdict}`} />
      ))}
    </div>
  );
}

function Row({
  candidate,
  open,
  onToggle,
}: {
  candidate: ProductCandidate;
  open: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const excluded = candidate.exclusions.length > 0;
  const te = candidate.equivalence?.teCode ?? null;
  return (
    <li className={`cx-row${excluded ? ' excluded' : ''}${open ? ' open' : ''}`}>
      <button className="cx-head" onClick={onToggle} aria-expanded={open}>
        <Signature attributes={candidate.attributes} />
        <span className="cx-ndc">{candidate.productNdc}</span>
        <span className="cx-maker">{candidate.labeler ?? '—'}</span>
        <span className="cx-flags">
          {te !== null && <b className="cx-te">{te}</b>}
          {candidate.reportedShortage && (
            <i className="cx-pulse" title="FDA reported presentation status; inspect details" />
          )}
          {excluded && <b className="cx-ex">EXCLUDED</b>}
        </span>
      </button>
      {open && <Detail candidate={candidate} />}
    </li>
  );
}

function Detail({ candidate }: { candidate: ProductCandidate }): React.ReactElement {
  return (
    <div className="cx-detail">
      {candidate.exclusions.map((reason) => (
        <p key={reason} className="cx-exline">
          {reason}
        </p>
      ))}
      <dl className="cx-attrs">
        {candidate.attributes.map((one) => (
          <div key={one.attribute} className={`cx-attr ${one.verdict}`}>
            <dt>{ATTRIBUTE_LABELS[one.attribute]}</dt>
            <dd>
              <span className="cx-val">{one.candidate ?? 'not stated'}</span>
              {one.verdict !== 'match' && (
                <span className="cx-ref">was {one.reference ?? '—'}</span>
              )}
              <small>{one.note}</small>
            </dd>
          </div>
        ))}
      </dl>
      {candidate.equivalence && (
        <div className="cx-te-block">
          <span>
            {candidate.equivalence.applicationNumber} · {candidate.equivalence.sponsor ?? '—'}
            {candidate.equivalence.marketingStatus !== null &&
              ` · ${candidate.equivalence.marketingStatus}`}
          </span>
          <small>{candidate.equivalence.teCodeNote}</small>
        </div>
      )}
      {candidate.reportedShortage && (
        <div className="cx-te-block">
          <span>
            FDA SHORTAGE · {candidate.reportedShortage.status} ·{' '}
            {candidate.reportedShortage.availability ?? 'availability not stated'}
          </span>
          <small>Reported by the manufacturer to FDA. Not a statement about your supply.</small>
        </div>
      )}
      <a
        href={`https://api.fda.gov/drug/ndc.json?search=product_ndc:"${candidate.productNdc}"`}
        target="_blank"
        rel="noreferrer"
        className="cx-src"
      >
        FDA listing ↗
      </a>
    </div>
  );
}

type Filter = 'viable' | 'excluded' | 'all';

function Empty({ busy, refresh }: { busy: boolean; refresh: () => void }): React.ReactElement {
  return (
    <div className="cx-empty">
      <p>Find other FDA-listed products that share this medicine&rsquo;s active ingredient.</p>
      <button className="op-primary" disabled={busy} onClick={refresh}>
        {busy ? 'Searching openFDA…' : 'Discover candidates →'}
      </button>
      <small>Listings only. Not stock, not an offer, not a substitution recommendation.</small>
    </div>
  );
}

export function CandidatesPanel({
  set,
  busy,
  refresh,
}: {
  set: CandidateSet | null;
  busy: boolean;
  refresh: () => void;
}): React.ReactElement {
  const [filter, setFilter] = useState<Filter>('viable');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo<ProductCandidate[]>(() => {
    if (set === null) return [];
    if (filter === 'all') return set.candidates;
    const wantExcluded = filter === 'excluded';
    return set.candidates.filter((one) => one.exclusions.length > 0 === wantExcluded);
  }, [set, filter]);

  if (set === null) return <Empty busy={busy} refresh={refresh} />;

  const viable = set.candidates.filter((one) => one.exclusions.length === 0).length;
  const counts: Record<Filter, number> = {
    viable,
    excluded: set.candidates.length - viable,
    all: set.candidates.length,
  };

  return (
    <div className="cx">
      <div className="cx-baseline">
        <span className="cx-baseline-tag">BASELINE</span>
        <h4>{set.referenceLabel}</h4>
        <span className="cx-baseline-ndc">{set.referenceNdc ?? 'no unambiguous baseline NDC'}</span>
      </div>

      <div className="cx-count">
        <strong>{viable}</strong>
        <span>
          of {set.candidates.length} listings carry no disqualifying exclusion
          {set.coverage.reportedTotal === null
            ? ' · FDA total unavailable'
            : ` · FDA reports ${String(set.coverage.reportedTotal)} listings for this query`}
          {set.coverage.truncated ? ' · retrieval is incomplete' : ''}
        </span>
      </div>

      <div className="cx-filters">
        {(['viable', 'excluded', 'all'] as const).map((one) => (
          <button
            key={one}
            aria-pressed={filter === one}
            onClick={() => {
              setFilter(one);
            }}
          >
            {one === 'viable' ? 'not excluded' : one} <b>{counts[one]}</b>
          </button>
        ))}
        <button className="cx-refresh" disabled={busy} onClick={refresh}>
          {busy ? '…' : '↻'}
        </button>
      </div>

      <div className="cx-legend">
        <span>
          <i className="cx-seg match" />
          match
        </span>
        <span>
          <i className="cx-seg differs" />
          differs
        </span>
        <span>
          <i className="cx-seg unknown" />
          unknown
        </span>
        <span className="cx-legend-order">ingredients · strength · form · route · category</span>
      </div>

      <ul className="cx-list">
        {rows.map((candidate, index) => (
          <Row
            key={`${candidate.productNdc}:${String(index)}`}
            candidate={candidate}
            open={open === `${candidate.productNdc}:${String(index)}`}
            onToggle={() => {
              const key = `${candidate.productNdc}:${String(index)}`;
              setOpen(open === key ? null : key);
            }}
          />
        ))}
        {rows.length === 0 && <li className="cx-none">Nothing in this group.</li>}
      </ul>

      <details className="cx-limits">
        <summary>Limits &amp; sources</summary>
        <ul>
          {set.limits.map((one) => (
            <li key={one}>{one}</li>
          ))}
        </ul>
        {set.sources.map((one) => (
          <a key={one.source_url} href={one.source_url} target="_blank" rel="noreferrer">
            {one.source_name} ↗
          </a>
        ))}
      </details>
    </div>
  );
}
