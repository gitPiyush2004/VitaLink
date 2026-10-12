import { useEffect, useState } from 'react';

import type { Investigation, InvestigationDecisionInput } from '@vitalink/contracts';

import { dateLabel } from './api';
import { decisionLabel } from './source-history';

export function DecisionPanel({
  record,
  busy,
  change,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
}): React.ReactElement {
  const [action, setAction] = useState<InvestigationDecisionInput['action']>(
    record.decision?.action ?? 'monitor',
  );
  const [rationale, setRationale] = useState(record.decision?.rationale ?? '');
  const [candidateNdc, setCandidateNdc] = useState(record.decision?.candidateNdc ?? '');
  const [note, setNote] = useState('');
  useEffect(() => {
    setNote('');
  }, [record.notes.length]);
  const allCandidates = record.candidates?.candidates ?? [];
  const candidates = allCandidates.filter(
    (c) =>
      c.exclusions.length === 0 &&
      allCandidates.filter((other) => other.productNdc === c.productNdc).length === 1,
  );
  return (
    <section>
      <h3>Record the next action</h3>
      <p className="op-muted">
        Use the public evidence to record what should happen next and why. This saves analyst
        intent; it does not order stock, dispatch freight or approve a medicine substitution.
      </p>
      {record.decision && (
        <div className="op-current-source">
          <b>{decisionLabel(record.decision.action)}</b>
          <p>{record.decision.rationale}</p>
          <small>
            Recorded {dateLabel(record.decision.recordedAt)}
            {record.decision.candidateNdc ? ` · product NDC ${record.decision.candidateNdc}` : ''}
          </small>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          change(
            {
              action,
              rationale,
              candidateNdc: action === 'investigate_candidate' ? candidateNdc : null,
            },
            '/decision',
          );
        }}
      >
        <label>
          Next action
          <select
            disabled={busy}
            value={action}
            onChange={(event) => {
              setAction(event.target.value as InvestigationDecisionInput['action']);
            }}
          >
            <option value="monitor">Monitor source updates</option>
            <option value="investigate_candidate">Investigate a product candidate</option>
            <option value="escalate">Escalate for professional review</option>
            <option value="documented_response" disabled={!record.plan?.selectedOptionId}>
              Follow a saved response decision
            </option>
          </select>
        </label>
        {action === 'investigate_candidate' && (
          <>
            <label>
              Product to investigate
              <select
                required
                value={candidateNdc}
                disabled={busy}
                onChange={(event) => {
                  setCandidateNdc(event.target.value);
                }}
              >
                <option value="">Choose from the saved non-excluded candidates</option>
                {candidates.map((candidate) => (
                  <option key={candidate.productNdc} value={candidate.productNdc}>
                    {candidate.productNdc} · {candidate.labeler ?? candidate.genericName}
                  </option>
                ))}
              </select>
            </label>
            <p className="op-muted">
              This selection requests further investigation. Matching ingredients or a TE code do
              not establish clinical suitability or available stock.
            </p>
          </>
        )}
        <label>
          Reason and evidence to follow up
          <textarea
            required
            minLength={8}
            maxLength={4000}
            value={rationale}
            disabled={busy}
            onChange={(event) => {
              setRationale(event.target.value);
            }}
            placeholder="Explain what the source establishes, what remains unknown, and the next evidence or professional review needed."
          />
        </label>
        <button
          className="op-primary"
          disabled={
            busy ||
            rationale.trim().length < 8 ||
            (action === 'investigate_candidate' && !candidateNdc)
          }
        >
          Save next action
        </button>
      </form>
      <h3>Case notes</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          change({ note });
        }}
      >
        <label>
          Additional evidence or reasoning
          <textarea
            required
            maxLength={4000}
            disabled={busy}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
        <button disabled={busy || !note.trim()}>Save note</button>
      </form>
      {record.notes.map((one) => (
        <div key={one.id} className="op-audit">
          <time>{dateLabel(one.at)}</time>
          <p>{one.text}</p>
        </div>
      ))}
      <label>
        Workflow status
        <select
          disabled={busy}
          value={record.status}
          onChange={(event) => {
            change({ status: event.target.value });
          }}
        >
          <option value="OPEN">Open</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="ACTIONED">Decision recorded</option>
          <option value="CLOSED">Closed</option>
        </select>
      </label>
      <details>
        <summary>Case activity history ({record.history.length})</summary>
        {[...record.history].reverse().map((one, index) => (
          <div className="op-audit" key={`${one.at}-${String(index)}`}>
            <time>{dateLabel(one.at)}</time>
            <p>{one.action}</p>
          </div>
        ))}
      </details>
    </section>
  );
}
