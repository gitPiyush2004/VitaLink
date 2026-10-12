import { useEffect, useState } from 'react';

import type { Investigation } from '@vitalink/contracts';
import { QuantityValue, QuoteStatusChip } from '@vitalink/ui';

import { request } from '../api/client';
import { getRecommendation, type RecommendationRow, type ShipmentRow } from '../api/queries';

type PlaceInput = { name: string; city: string; country: string; point: null };
function emptyPlace(): PlaceInput {
  return { name: '', city: '', country: '', point: null };
}
export function LogisticsPanel({
  record,
  busy,
  change,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
}): React.ReactElement {
  const [origin, setOrigin] = useState(emptyPlace);
  const [destination, setDestination] = useState(emptyPlace);
  const [weight, setWeight] = useState('');
  const [packages, setPackages] = useState('');
  const [dimensions, setDimensions] = useState({ l: '', w: '', h: '' });
  const [budget, setBudget] = useState('');
  const [result, setResult] = useState<RecommendationRow | null>(null);
  const [shipment, setShipment] = useState<ShipmentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    if (record.recommendationId) {
      void getRecommendation(record.recommendationId)
        .then(async (recommendation) => {
          const one = await request<ShipmentRow>(
            `/logistics/shipments/${recommendation.shipmentRequestId}`,
          );
          if (active) {
            setResult(recommendation);
            setShipment(one);
          }
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : 'Comparison unavailable');
        });
    }
    return () => {
      active = false;
    };
  }, [record.recommendationId]);
  async function compare(): Promise<void> {
    setWorking(true);
    setError(null);
    try {
      const response = await request<{ shipment: ShipmentRow; recommendation: RecommendationRow }>(
        '/logistics/recommendations',
        {
          method: 'POST',
          body: {
            cascade_id: record.cascadeId,
            drug_id: record.analysis?.drugId,
            consignment: {
              origin,
              destination,
              hub_id_destination: `operator:${destination.name}`,
              weight_kg: Number(weight),
              dimensions_cm: [
                { l: Number(dimensions.l), w: Number(dimensions.w), h: Number(dimensions.h) },
              ],
              number_of_packages: Number(packages),
              affected_population: null,
              budget_ceiling_inr: budget ? Number(budget) : null,
            },
          },
        },
      );
      setResult(response.recommendation);
      setShipment(response.shipment);
      change({ recommendationId: response.recommendation.id }, '/link');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Carrier comparison failed');
    } finally {
      setWorking(false);
    }
  }
  if (!record.cascadeId) {
    return (
      <p className="op-empty">
        Run a trace first. Carrier constraints and deadlines will be derived from that disruption
        context and the medicine’s storage label.
      </p>
    );
  }
  return (
    <>
      <h3>Pharmaceutical carrier comparison</h3>
      <p className="op-muted">
        Linked to this investigation’s trace. Temperature, deadline and urgency come from the
        medicine and cover projection. Enter consignment facts that public records cannot supply.
        Prices use the existing carrier adapters; missing credentials remain unavailable.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void compare();
        }}
      >
        <PlaceFields label="Origin" value={origin} set={setOrigin} />
        <PlaceFields label="Destination" value={destination} set={setDestination} />
        <div className="op-field-row">
          <label>
            Total weight (kg)
            <input
              required
              type="number"
              min="0.001"
              max="50000"
              step="any"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
              }}
            />
          </label>
          <label>
            Packages
            <input
              required
              type="number"
              min="1"
              max="5000"
              value={packages}
              onChange={(event) => {
                setPackages(event.target.value);
              }}
            />
          </label>
        </div>
        <p className="op-muted">
          Enter dimensions for one package size. For mixed sizes use the API’s full dimension list.
        </p>
        <div className="op-field-row">
          {(['l', 'w', 'h'] as const).map((key) => (
            <label key={key}>
              {key.toUpperCase()} (cm)
              <input
                required
                type="number"
                min="0.01"
                max="1200"
                step="any"
                value={dimensions[key]}
                onChange={(event) => {
                  setDimensions({ ...dimensions, [key]: event.target.value });
                }}
              />
            </label>
          ))}
        </div>
        <label>
          Budget ceiling (INR, optional)
          <input
            type="number"
            min="1"
            max="100000000"
            value={budget}
            onChange={(event) => {
              setBudget(event.target.value);
            }}
          />
        </label>
        <button className="op-primary" disabled={busy || working}>
          {working ? 'Querying carriers…' : 'Derive shipment & compare carriers →'}
        </button>
      </form>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {shipment && (
        <details open>
          <summary>Derived shipment requirements</summary>
          <dl className="op-facts">
            <dt>Temperature</dt>
            <dd>{shipment.request.temperature_requirement}</dd>
            <dt>Deadline</dt>
            <dd>{shipment.request.required_delivery_deadline}</dd>
            <dt>Urgency</dt>
            <dd>{shipment.request.urgency}</dd>
            <dt>Handling</dt>
            <dd>{shipment.request.special_handling.join(', ')}</dd>
          </dl>
          <ul>
            {shipment.derivation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {result && <CarrierResults result={result} />}
    </>
  );
}
function PlaceFields({
  label,
  value,
  set,
}: {
  label: string;
  value: PlaceInput;
  set: (value: PlaceInput) => void;
}): React.ReactElement {
  return (
    <fieldset>
      <legend>{label} · operator supplied</legend>
      <label>
        Facility name
        <input
          required
          value={value.name}
          onChange={(event) => {
            set({ ...value, name: event.target.value });
          }}
        />
      </label>
      <div className="op-field-row">
        <label>
          City
          <input
            required
            value={value.city}
            onChange={(event) => {
              set({ ...value, city: event.target.value });
            }}
          />
        </label>
        <label>
          Country (ISO code)
          <input
            required
            minLength={2}
            maxLength={2}
            placeholder="US"
            value={value.country}
            onChange={(event) => {
              set({ ...value, country: event.target.value.toUpperCase() });
            }}
          />
        </label>
      </div>
    </fieldset>
  );
}
function CarrierResults({ result }: { result: RecommendationRow }): React.ReactElement {
  return (
    <>
      <h3>
        {result.recommendedQuoteId ? 'Recommended from available quotes' : 'No eligible carrier'}
      </h3>
      <p className="op-callout">{result.coverageNote}</p>
      <p className="op-muted">
        Profile: {result.weightProfile.name} · {result.weightProfile.selectedBecause}
      </p>
      {result.quotes.map((quote) => {
        const gate = result.recommendation.eligibility.find((one) => one.quoteId === quote.id);
        const score = result.recommendation.scored.find((one) => one.quoteId === quote.id);
        return (
          <div className="op-source" key={quote.id}>
            <div className="op-title-row">
              <b>{quote.provider_display}</b>
              <QuoteStatusChip status={quote.quote_status} />
            </div>
            <p>
              {quote.quote_status === 'UNAVAILABLE' ? (
                quote.unavailable_reason
              ) : (
                <>
                  {quote.price ? <QuantityValue quantity={quote.price} /> : 'Price unavailable'} ·{' '}
                  {quote.transit_hours ? (
                    <QuantityValue quantity={quote.transit_hours} />
                  ) : (
                    'Transit unavailable'
                  )}
                </>
              )}
            </p>
            {gate?.result.isEligible ? (
              <p className="op-tag cyan">ELIGIBLE · score {score?.finalScore.toFixed(1)}</p>
            ) : (
              <p className="op-tag amber">NOT ELIGIBLE</p>
            )}
            <ul>
              {gate?.result.failures.map((failure) => (
                <li key={failure.reason}>
                  {failure.reason}: {failure.detail}
                </li>
              ))}
            </ul>
            {score && (
              <details>
                <summary>Arithmetic and assumptions</summary>
                <pre>{JSON.stringify(score, null, 2)}</pre>
              </details>
            )}
          </div>
        );
      })}
    </>
  );
}
