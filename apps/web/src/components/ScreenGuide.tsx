/**
 * The plain-English header every screen opens with.
 *
 * One question and two or three instructions, taken from `nav.ts`. It is
 * rendered by the shell rather than by each view, so a new screen cannot ship
 * without one — the guide is part of the frame, not something a view remembers
 * to include.
 *
 * The wording rule for `question`: it has to be a sentence somebody would
 * actually say out loud. "Which drugs have a fragility index above threshold" is
 * not one. "If this supplier stops tomorrow, which medicines run out" is.
 */

import { tabMeta, type TabId } from '../nav';

export function ScreenGuide({ tab }: { tab: TabId }): React.ReactElement {
  const meta = tabMeta(tab);

  return (
    <section className="vl-guide">
      <div>
        <p className="vl-guide-label">What this screen answers</p>
        <p className="vl-guide-q">{meta.question}</p>
      </div>
      <div>
        <p className="vl-guide-label">How to use it</p>
        <ol className="vl-guide-steps">
          {meta.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Every term in this product that is not ordinary English, and what it means.
 *
 * Written for someone who runs a supply chain, not someone who has read the
 * source. Each entry gives the plain meaning first and the technical name second,
 * because the plain meaning is what the reader needs and the technical name is
 * what they will see on the screen.
 */
const TERMS = [
  {
    term: 'Cascade',
    plain: 'The knock-on effect. One supplier stops, and this traces what breaks next, and next.',
  },
  {
    term: 'Exposure',
    plain:
      'How much of a problem reaches a particular medicine. 100% means it is fully dependent on what broke.',
  },
  {
    term: 'Days of cover',
    plain:
      'How long your current stock lasts before you run out. Shown as a range, because it depends on the figure you entered.',
  },
  {
    term: 'Quarantine',
    plain:
      'Reports we saw but could not confirm with a second source. Kept, with the reason, rather than thrown away.',
  },
  {
    term: 'Veracity',
    plain:
      'How much a report can be trusted, from 0 to 1. Built from independence, source credibility and how recent it is.',
  },
  {
    term: 'Independent sources',
    plain:
      'Two different organisations, not two web pages. Both openFDA feeds are the FDA, so they count as one.',
  },
  {
    term: 'Pareto front',
    plain:
      'The options genuinely worth considering. Everything else is beaten by something on both cost and shortage, so nobody would pick it.',
  },
  {
    term: 'Dominated',
    plain:
      'An option that is worse on every measure than another one. Ruled out with no opinion required.',
  },
  {
    term: 'Single source',
    plain:
      'One company effectively supplies the whole market. If it stops, there is no second supplier to switch to.',
  },
  {
    term: 'z_plant and z_api',
    plain:
      'How many independent makers exist — of the finished medicine, and of its active ingredient. Low means fragile.',
  },
  {
    term: 'HHI',
    plain:
      'A standard measure of how concentrated a market is. High means a few companies hold most of it.',
  },
  {
    term: 'Cold chain',
    plain:
      'A medicine that must stay refrigerated end to end. Break it once and the stock is written off.',
  },
  {
    term: 'Eligible / not eligible',
    plain:
      'A courier that fails a hard rule — wrong temperature, no licence, too slow — is removed, not given a low score.',
  },
  {
    term: 'Sandbox price',
    plain:
      'A test number from a demo system. Real in shape, not a real price, and never to be quoted to anyone.',
  },
] as const;

export function Glossary(): React.ReactElement {
  return (
    <dl className="vl-glossary">
      {TERMS.map((entry) => (
        <div key={entry.term}>
          <dt>{entry.term}</dt>
          <dd>{entry.plain}</dd>
        </div>
      ))}
    </dl>
  );
}
