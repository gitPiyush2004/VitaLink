import { useState } from 'react';

import type { Investigation, ResponsePlanInput } from '@vitalink/contracts';
import { QuantityValue } from '@vitalink/ui';

type Option = ResponsePlanInput['options'][number];
function newOption(): Option {
  return {
    id: crypto.randomUUID(),
    label: '',
    leadDays: 0,
    additionalCoverDays: 0,
    cost: 0,
    basis: 'operator_estimate',
    evidenceUrl: null,
    evidenceNote: '',
  };
}
export function ResponsePlanner({
  record,
  busy,
  save,
  select,
}: {
  record: Investigation;
  busy: boolean;
  save: (input: ResponsePlanInput) => void;
  select: (id: string) => void;
}): React.ReactElement {
  const [input, setInput] = useState<ResponsePlanInput>(
    () =>
      record.plan?.input ?? {
        currentCoverDays: 0,
        disruptionDays: 1,
        inputBasis: '',
        currency: 'USD',
        options: [newOption()],
      },
  );
  function optionChange(id: string, patch: Partial<Option>): void {
    setInput((old) => ({
      ...old,
      options: old.options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    }));
  }
  return (
    <>
      <div className="op-section-label">03 / RESPONSE DECISION</div>
      <h3>Protect days of supply</h3>
      <p className="op-muted">
        Enter your inventory and an interruption assumption. Compare actual supplier offers or
        clearly labelled estimates. No inventory or quote is inferred from FDA data.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(input);
        }}
      >
        <div className="op-field-row">
          <label>
            Current cover (days)
            <input
              required
              type="number"
              min="0"
              max="365"
              step="any"
              value={input.currentCoverDays}
              onChange={(event) => {
                setInput({ ...input, currentCoverDays: Number(event.target.value) });
              }}
            />
          </label>
          <label>
            Interruption (days)
            <input
              required
              type="number"
              min="0.01"
              max="365"
              step="any"
              value={input.disruptionDays}
              onChange={(event) => {
                setInput({ ...input, disruptionDays: Number(event.target.value) });
              }}
            />
          </label>
          <label>
            Currency
            <select
              value={input.currency}
              onChange={(event) => {
                setInput({
                  ...input,
                  currency: event.target.value as ResponsePlanInput['currency'],
                });
              }}
            >
              {['USD', 'INR', 'EUR', 'GBP'].map((one) => (
                <option key={one}>{one}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Inventory source and interruption rationale
          <textarea
            required
            minLength={8}
            maxLength={1000}
            placeholder="Where did these inputs come from? Include the date and basis."
            value={input.inputBasis}
            onChange={(event) => {
              setInput({ ...input, inputBasis: event.target.value });
            }}
          />
        </label>
        {input.options.map((option, index) => (
          <fieldset key={option.id}>
            <legend>Response {index + 1}</legend>
            <label>
              Supplier / action
              <input
                required
                maxLength={160}
                value={option.label}
                onChange={(event) => {
                  optionChange(option.id, { label: event.target.value });
                }}
              />
            </label>
            <div className="op-field-row">
              <label>
                Arrival (days)
                <input
                  required
                  type="number"
                  min="0"
                  max="365"
                  step="any"
                  value={option.leadDays}
                  onChange={(event) => {
                    optionChange(option.id, { leadDays: Number(event.target.value) });
                  }}
                />
              </label>
              <label>
                Added cover (days)
                <input
                  required
                  type="number"
                  min="0"
                  max="365"
                  step="any"
                  value={option.additionalCoverDays}
                  onChange={(event) => {
                    optionChange(option.id, { additionalCoverDays: Number(event.target.value) });
                  }}
                />
              </label>
              <label>
                Total cost
                <input
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step="any"
                  value={option.cost}
                  onChange={(event) => {
                    optionChange(option.id, { cost: Number(event.target.value) });
                  }}
                />
              </label>
            </div>
            <label>
              Evidence basis
              <select
                value={option.basis}
                onChange={(event) => {
                  optionChange(option.id, { basis: event.target.value as Option['basis'] });
                }}
              >
                <option value="operator_estimate">Operator estimate</option>
                <option value="documented_quote">Documented quote</option>
              </select>
            </label>
            <label>
              Evidence URL {option.basis === 'documented_quote' ? '(required)' : '(optional)'}
              <input
                type="url"
                required={option.basis === 'documented_quote'}
                value={option.evidenceUrl ?? ''}
                onChange={(event) => {
                  optionChange(option.id, { evidenceUrl: event.target.value || null });
                }}
              />
            </label>
            <label>
              Evidence note
              <input
                required
                maxLength={1000}
                placeholder="Source, quote date, validity, or estimation basis"
                value={option.evidenceNote}
                onChange={(event) => {
                  optionChange(option.id, { evidenceNote: event.target.value });
                }}
              />
            </label>
            {input.options.length > 1 && (
              <button
                type="button"
                className="op-text-button"
                onClick={() => {
                  setInput({
                    ...input,
                    options: input.options.filter((one) => one.id !== option.id),
                  });
                }}
              >
                Remove response
              </button>
            )}
          </fieldset>
        ))}
        <div className="op-actions">
          <button
            type="button"
            disabled={input.options.length >= 12 || busy}
            onClick={() => {
              setInput({ ...input, options: [...input.options, newOption()] });
            }}
          >
            + Add response
          </button>
          <button className="op-primary" disabled={busy}>
            Save comparison
          </button>
        </div>
      </form>
      {record.plan && (
        <div className="op-comparison">
          <h3>Saved comparison</h3>
          <p className="op-muted">
            Conditional scenario · constant consumption · late stock cannot repair an earlier gap.
            Changes above apply after saving.
          </p>
          <table>
            <thead>
              <tr>
                <th>Response</th>
                <th>Uncovered</th>
                <th>Cost</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {record.plan.rows.map((row) => (
                <tr
                  key={row.id}
                  className={record.plan?.selectedOptionId === row.id ? 'selected' : ''}
                >
                  <td>
                    {row.label}
                    <small>
                      {row.dominated ? 'Dominated on cost and gap' : 'Pareto efficient'}
                      {row.arrivesBeforeStockout === false ? ' · Arrives after stockout' : ''}
                    </small>
                  </td>
                  <td>
                    <QuantityValue quantity={row.uncoveredDays} />
                  </td>
                  <td>
                    <QuantityValue quantity={row.cost} />
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => {
                        select(row.id);
                      }}
                    >
                      {record.plan?.selectedOptionId === row.id ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="op-muted">
            Pareto efficient means no listed alternative is both cheaper and leaves fewer uncovered
            days. Clinical suitability and supplier approval remain operator checks.
          </p>
        </div>
      )}
    </>
  );
}
