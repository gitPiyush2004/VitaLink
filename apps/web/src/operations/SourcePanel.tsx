import { useState } from 'react';

import type { Watch } from '@vitalink/contracts';

import { dateLabel, operations, type Dashboard } from './api';
import { NewsPanel } from './NewsPanel';

export function SourcePanel({
  data,
  busy,
  act,
  notice,
}: {
  data: Dashboard | null;
  busy: boolean;
  act: (task: () => Promise<unknown>) => Promise<void>;
  notice: (message: string) => void;
}): React.ReactElement {
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<Watch['kind']>('medicine');
  return (
    <div className="op-source-list">
      <button
        className="op-primary"
        disabled={busy || !data?.worker.online}
        onClick={() => {
          void act(async () => {
            await operations.refresh();
            notice(
              'Refresh queued. Source status updates automatically. Cached responses retain their original fetch timestamps.',
            );
          });
        }}
      >
        Refresh sources
      </button>
      <p className="op-muted">
        Hourly ingestion. Upstream cache TTLs may be longer; each event shows its actual source
        fetch time.
      </p>
      {data?.feeds.map((feed) => (
        <div className="op-source" key={feed.id}>
          <div className="op-title-row">
            <b>{feed.label}</b>
            <span className={`op-tag ${feed.state === 'error' ? 'red' : 'cyan'}`}>
              {feed.state}
            </span>
          </div>
          <p>{feed.coverage}</p>
          <small>
            Last success: {dateLabel(feed.succeededAt)}
            <br />
            {feed.records} fetched · {feed.changed} changed
          </small>
          {feed.error && <p className="op-error">{feed.error}</p>}
        </div>
      ))}
      <NewsPanel />
      <h3>Watchlist</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act(async () => {
            await operations.watch(term, kind);
            setTerm('');
          });
        }}
      >
        <label>
          Track a medicine or company
          <input
            required
            minLength={2}
            maxLength={120}
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
        </label>
        <div className="op-title-row">
          <select
            aria-label="Watch type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as Watch['kind']);
            }}
          >
            <option value="medicine">Medicine</option>
            <option value="company">Company</option>
          </select>
          <button disabled={busy}>Add watch</button>
        </div>
      </form>
      {data?.watches.map((watch) => (
        <div className="op-title-row op-watch" key={watch.id}>
          <span>
            {watch.term}
            <small>{watch.kind}</small>
          </span>
          <button
            aria-label={`Remove watch for ${watch.term}`}
            disabled={busy}
            onClick={() => {
              void act(() => operations.unwatch(watch.id));
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
