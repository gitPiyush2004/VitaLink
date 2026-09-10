/**
 * The control tower's front page.
 *
 * ## Why this screen exists at all
 *
 * The first version of this UI opened straight into stage 1, which meant the
 * first thing anyone saw was a table of raw openFDA rows. That is the least
 * interesting output the system produces, and it made a nine-stage pipeline look
 * like a list feature. The argument of the project — these stages are one loop,
 * and the loop refuses to guess — was nowhere on screen.
 *
 * So the loop is the screen. Nine stages across the top, each carrying the one
 * live figure that says whether it has run, and each a link into its own view.
 *
 * ## The second panel is the honest one
 *
 * "What this system will not tell you" is not modesty and it is not filler. Four
 * of the numbers an operator most wants — population at risk, rupee loss,
 * facilities affected, carrier reliability — cannot be produced from open data,
 * and a dashboard that quietly omitted them would read as though they had been
 * considered and found to be zero. Naming them, with the specific missing input
 * beside each, is the difference between a gap and a lie.
 */

import { Empty, Meter, MeterList, Note, Panel, Stat, StatGrid, type Tone } from '@vitalink/ui';

import { quarantinedTotal, topQuarantineReason, type Overview } from '../api/overview';
import { Glossary } from '../components/ScreenGuide';
import { type TabId } from '../nav';

import type { ViewProps } from './types';

type Stage = { n: string; name: string; tab: TabId; fact: (data: Overview) => string };

/** The nine stages, with the one live figure that says whether each has run. */
const LOOP: Stage[] = [
  { n: '1', name: 'SENSE', tab: 'sense', fact: (d) => `${String(d.signals.length)} signals` },
  {
    n: '2',
    name: 'VERIFY',
    tab: 'sense',
    fact: (d) =>
      `${String(d.alerts.length)} published, ${String(quarantinedTotal(d.quarantine))} held`,
  },
  { n: '3', name: 'MAP', tab: 'catalog', fact: (d) => `${String(d.drugs.length)} drugs mapped` },
  { n: '4', name: 'TRACE', tab: 'cascade', fact: (d) => `${String(d.cascades.length)} cascades` },
  {
    n: '5',
    name: 'QUANTIFY',
    tab: 'cascade',
    fact: (d) => `${String(exposedDrugs(d))} drugs exposed`,
  },
  {
    n: '6',
    name: 'SIMULATE',
    tab: 'decide',
    fact: (d) => `${String(scenarioCount(d))} scenarios`,
  },
  { n: '7', name: 'DECIDE', tab: 'decide', fact: (d) => `${String(d.runs.length)} decisions` },
  {
    n: '8',
    name: 'EXECUTE',
    tab: 'logistics',
    fact: (d) => `${String(d.carriers.length)} carriers attempted`,
  },
  { n: '9', name: 'LEARN', tab: 'learn', fact: () => 'not built — why' },
];

/** Numbers this system deliberately does not produce, and the input each needs. */
const REFUSALS = [
  {
    field: 'population at risk',
    needs:
      'geocoded facilities and a catchment model. No public source maps a plant to the people who depend on it.',
  },
  {
    field: 'rupee loss avoided',
    needs:
      'NPPA ceiling prices joined to demand. There is no NPPA client, so there is no honest rupee basis.',
  },
  {
    field: 'facilities affected',
    needs: 'the physical layer — hubs, lanes, and their coordinates. None of it is built.',
  },
  {
    field: 'carrier reliability',
    needs:
      'outcome tracking, which is stage 9. The sub-score stays neutral rather than inventing an on-time rate.',
  },
];

function exposedDrugs(data: Overview): number {
  return data.cascades[0]?.exposedDrugs.length ?? 0;
}

function scenarioCount(data: Overview): number {
  return data.runs.reduce((total, run) => total + run.scenarios.length, 0);
}

export function OverviewView({ overview, navigate }: ViewProps): React.ReactElement {
  if (overview === null) {
    return (
      <Panel title="Loading the loop">
        <Empty reason="Reading the eight collections that describe what this system has done so far." />
      </Panel>
    );
  }

  const held = quarantinedTotal(overview.quarantine);
  const topReason = topQuarantineReason(overview.quarantine);
  const coldChain = overview.drugs.filter((drug) => drug.coldChain).length;
  const quoting = overview.carriers.filter((carrier) => carrier.isConfigured).length;

  return (
    <>
      {overview.failures.length === 0 ? null : (
        <Note tone="danger" title="Some of this page could not be read">
          {overview.failures.map((one) => `${one.part}: ${one.error}`).join(' · ')}. The figures for
          those parts are missing rather than zero.
        </Note>
      )}

      <Panel
        title="The loop"
        eyebrow="Nine stages, one pipeline"
        subtitle="Each stage feeds the next. Click one to open it."
        flush
      >
        <div className="vl-loop" style={{ padding: '14px 18px 18px' }}>
          {LOOP.map((stage) => (
            <button
              key={stage.n}
              type="button"
              className="vl-loop-stage"
              data-state={stage.tab === 'learn' ? 'absent' : 'done'}
              onClick={() => {
                navigate(stage.tab);
              }}
            >
              <span className="vl-loop-num">STAGE {stage.n}</span>
              <p className="vl-loop-name">{stage.name}</p>
              <p className="vl-loop-fact">{stage.fact(overview)}</p>
            </button>
          ))}
        </div>
      </Panel>

      <StatGrid>
        <Stat
          label="Signals ingested"
          value={overview.signals.length}
          note="openFDA enforcement, openFDA shortages, GDELT news"
          tone="real"
        />
        <Stat
          label="Alerts published"
          value={overview.alerts.length}
          note="cleared two genuinely independent publishers"
          tone={overview.alerts.length === 0 ? 'modelled' : 'real'}
        />
        <Stat
          label="Held in quarantine"
          value={held}
          note={
            topReason === null
              ? 'nothing has been verified yet'
              : `most common: ${topReason.reason.replaceAll('_', ' ')}`
          }
          tone="modelled"
        />
        <Stat
          label="Drugs in the graph"
          value={overview.drugs.length}
          note={`${String(coldChain)} cold-chain, from each label's own storage text`}
          tone="derived"
        />
        <Stat
          label="Carriers attempted"
          value={overview.carriers.length}
          note={`${String(quoting)} can return a price; the rest say why they cannot`}
          tone="derived"
        />
        <Stat
          label="Population at risk"
          unavailable="No geocoded facilities and no catchment model. The physical layer is not built, so this is absent rather than estimated."
          note="needs the physical layer — see below"
          tone="danger"
        />
      </StatGrid>

      <div className="vl-grid-2">
        <Panel
          title="What VERIFY decided"
          eyebrow="Stage 2"
          subtitle="Every story the system saw, and the rule that let it through or held it back."
        >
          {held === 0 ? (
            <Empty reason="Nothing has been verified in this organisation yet. Open Sense + Verify and run the two commands." />
          ) : (
            <>
              <MeterList>
                {Object.entries(overview.quarantine).map(([reason, count]) => (
                  <Meter
                    key={reason}
                    label={reason.replaceAll('_', ' ')}
                    value={count}
                    max={held}
                    display={String(count)}
                    tone="modelled"
                  />
                ))}
                <Meter
                  label="published as an alert"
                  value={overview.alerts.length}
                  max={held + overview.alerts.length}
                  display={String(overview.alerts.length)}
                  tone="real"
                />
              </MeterList>

              {overview.alerts.length > 0 ? null : (
                <Note tone="accent" title="This is the finding, not an empty screen">
                  Nothing cleared the two-independent-sources rule. An FDA recall is usually
                  reported by the FDA and nobody else, and two endpoints of one agency count as one
                  source — so the honest output of this stage is the quarantine, with a reason on
                  every row.
                </Note>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="What this system will not tell you"
          eyebrow="By design"
          subtitle="Four figures a dashboard like this normally shows. None can be produced honestly from open data yet."
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {REFUSALS.map((refusal) => (
              <div key={refusal.field} className="vl-note">
                <span className="vl-note-title">{refusal.field}</span>
                <div className="vl-muted" style={{ fontSize: '0.8125rem' }}>
                  {refusal.needs}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Every number on this system is labelled"
        eyebrow="How to read a figure"
        subtitle="Four labels, one rule: if we cannot say where a number came from, we do not print it."
      >
        <div className="vl-grid-2">
          {TAG_GUIDE.map((entry) => (
            <div key={entry.tag} className="vl-note" style={noteTone(entry.tone)}>
              <span className="vl-note-title">
                {entry.tag} — {entry.plain}
              </span>
              <div style={{ fontSize: '0.8125rem' }}>{entry.meaning}</div>
            </div>
          ))}
        </div>
        <p className="vl-chart-caption">
          Hover any figure in the app to see its source, the exact web address it came from, when it
          was fetched, and the full sum. Anything we could not work out shows{' '}
          <em>not available — why?</em> with the reason. Never a zero, never a dash — those two
          would let you mistake &ldquo;nothing is wrong&rdquo; for &ldquo;we do not know&rdquo;.
        </p>
      </Panel>

      <Panel
        title="Plain English"
        eyebrow="Glossary"
        subtitle="Every word on these screens that is not ordinary English."
      >
        <Glossary />
      </Panel>
    </>
  );
}

const TAG_GUIDE: { tag: string; plain: string; tone: Tone; meaning: string }[] = [
  {
    tag: 'REAL',
    plain: 'published',
    tone: 'real',
    meaning: 'An official source printed this exact number. We did nothing to it.',
  },
  {
    tag: 'DERIVED',
    plain: 'calculated',
    tone: 'derived',
    meaning:
      'We did the arithmetic from published numbers. Hover the value to see the working, with every term filled in.',
  },
  {
    tag: 'MODELLED',
    plain: 'estimated',
    tone: 'modelled',
    meaning:
      'A model produced it, so it is always shown as a low–high range. A single number would pretend to a precision the model does not have.',
  },
  {
    tag: 'SCENARIO',
    plain: 'assumed',
    tone: 'scenario',
    meaning:
      'Nobody publishes this, so somebody had to type it in — your stock level, for instance. Change the assumption and the answer changes.',
  },
];

/** Colours the note's left rule with the same hue as the tag it describes. */
function noteTone(tone: Tone): React.CSSProperties {
  return { '--vl-note-ink': `var(--vl-${tone})` } as React.CSSProperties;
}
