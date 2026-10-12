import { useState } from 'react';

import type { Investigation } from '@vitalink/contracts';

import { LogisticsPanel } from './LogisticsPanel';
import { ResponsePlanner } from './ResponsePlanner';
import { TracePanel } from './TracePanel';

export function ScenarioTools({
  record,
  busy,
  change,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
}): React.ReactElement {
  const [tab, setTab] = useState<'trace' | 'logistics' | 'response'>('trace');
  return (
    <section>
      <p className="op-callout">
        Optional tools for documented organisational inputs or explicitly stated scenarios. Public
        sources do not supply your inventory, supplier offers or freight quotes.
      </p>
      <nav className="op-tabs" aria-label="Optional scenario tools">
        {(['trace', 'logistics', 'response'] as const).map((name) => (
          <button
            key={name}
            aria-pressed={name === tab}
            onClick={() => {
              setTab(name);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'trace' &&
        (record.analysis ? (
          <TracePanel record={record} busy={busy} change={change} />
        ) : (
          <p>Identify a medicine before running a conditional trace.</p>
        ))}
      {tab === 'logistics' && <LogisticsPanel record={record} busy={busy} change={change} />}
      {tab === 'response' &&
        (record.analysis ? (
          <ResponsePlanner
            key={record.analysis.analysedAt}
            record={record}
            busy={busy}
            save={(input) => {
              change(input, '/plan');
            }}
            select={(id) => {
              change({ selectedOptionId: id });
            }}
          />
        ) : (
          <p>Identify a medicine before comparing conditional responses.</p>
        ))}
    </section>
  );
}
