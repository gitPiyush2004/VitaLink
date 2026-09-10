/**
 * The navigation, which is the loop — named for the person who would use it.
 *
 * ## Two vocabularies, and which one wins where
 *
 * The stage names are the specification's: SENSE, VERIFY, MAP, TRACE, QUANTIFY,
 * SIMULATE, DECIDE, EXECUTE, LEARN. They are precise, they are what every file
 * and document in this repository is organised around, and they are close to
 * meaningless to a supply-chain manager reading a screen for the first time.
 *
 * So the label is the job — "Disruption watch", "Impact", "Shipping" — and the
 * stage number stays on the badge beside it. Nobody has to learn a vocabulary to
 * use the tool, and nobody reading the code has to translate back.
 *
 * `question` and `steps` are the same idea one level deeper: every screen states
 * the one question it answers, in a sentence a pharmacist would use, and the two
 * or three things to actually do on it.
 *
 * ## Ordered by stage number, not by data dependency
 *
 * The tabs used to run 1–2, 3, 4–5, **8**, 6–7, because stage 8's carrier quotes
 * are an *input* to stage 6–7's scenario matrix. But the badges show the stage
 * numbers, and a sidebar reading 4·5 → 8 → 6·7 looks like a bug rather than a
 * considered ordering. The dependency is now stated where it actually helps — in
 * the DECIDE view's own empty state, which names the command to run first.
 *
 * Stage 9 is in the list and not built. Hiding it would make the loop look
 * complete; a screen explaining what is missing is the honest version, and it is
 * the same argument as showing a quarantine record instead of an empty list.
 *
 * Kept in its own module so `App.tsx` and the views can both name a tab without
 * importing each other.
 */

export const TABS = [
  {
    id: 'overview',
    step: '◇',
    label: 'Overview',
    title: 'Control tower',
    blurb: 'What is happening, what we can prove, and what we cannot tell you.',
    question: 'Is anything threatening my medicine supply today, and how sure are we?',
    steps: [
      'Read the nine stages along the top — each shows what it has found so far.',
      'Click any stage to open it, or use the menu on the left.',
      'Anything marked "not available" is a gap we can name, not a zero.',
    ],
  },
  {
    id: 'sense',
    step: '1·2',
    label: 'Disruption watch',
    title: 'Disruption watch',
    blurb:
      'We read official recall and shortage notices plus world news, and only raise an alert when two independent sources say the same thing.',
    question: 'What has gone wrong in the world, and which reports can I actually trust?',
    steps: [
      'Press "Run SENSE" to pull today\'s recall, shortage and news feeds.',
      'Press "Run VERIFY" to check each story against a second, unrelated publisher.',
      'Alerts are what survived. Quarantine is what we saw but could not confirm — with the reason.',
    ],
  },
  {
    id: 'catalog',
    step: '3',
    label: 'Products',
    title: 'Product catalogue',
    blurb:
      'Every medicine we track: how cold it has to be kept, and how many companies actually make it.',
    question: 'For each medicine, how cold must it stay and how many suppliers are there really?',
    steps: [
      'Look at "Supply": SINGLE SOURCE means one company effectively holds the whole market.',
      'Storage comes from the printed label, not from a guess — including ranges the label forbids.',
      'The two backup columns are how many independent makers exist at each level.',
    ],
  },
  {
    id: 'cascade',
    step: '4·5',
    label: 'Impact',
    title: 'Impact analysis',
    blurb:
      'If one ingredient or one plant stops, this shows which medicines run short and roughly when.',
    question: 'If this supplier stops tomorrow, which medicines run out — and how long do I have?',
    steps: [
      'Enter what broke (an ingredient or a manufacturer) and how many days of stock you hold.',
      'Press "Run cascade". The table lists every medicine the problem reaches.',
      'The chart shows when stock runs out. It is a range, because your stock figure is an estimate.',
    ],
  },
  {
    id: 'decide',
    step: '6·7',
    label: 'Options',
    title: 'Your options',
    blurb:
      'Every realistic response side by side — what each costs, and how much shortage each prevents.',
    question: 'What are my choices, what does each cost, and which one should I take?',
    steps: [
      'The chart shows every option. Filled dots are worth considering; hollow dots are beaten outright.',
      'The ringed dot is our recommendation, chosen using the weights shown at the bottom.',
      'Disagree with the weights? Pick any other filled dot — they are all defensible.',
    ],
  },
  {
    id: 'logistics',
    step: '8',
    label: 'Shipping',
    title: 'Shipping',
    blurb:
      'Which couriers can legally and physically carry this medicine, and which of them is the best choice.',
    question: 'Who can ship this medicine at the right temperature, in time — and who cannot?',
    steps: [
      "Constraints come from the medicine's own label. Nobody types them in.",
      'A courier marked NOT ELIGIBLE failed a hard rule and gets no score — it is not an option at all.',
      "The winner's score is broken down bar by bar, so you can see what it won on.",
    ],
  },
  {
    id: 'learn',
    step: '9',
    label: 'Learning',
    title: 'Learning — not built',
    blurb:
      'The stage that would check our past advice against what actually happened. It does not exist yet, and this page says what that costs.',
    question: 'How do we know the advice on the other screens is any good?',
    steps: [
      'Honestly: for four figures, we do not yet — and they are all named below.',
      'This stage would record real outcomes and calibrate against them.',
      'Until it exists, those four figures stay marked rather than quietly trusted.',
    ],
  },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export type TabMeta = (typeof TABS)[number];

export function tabMeta(id: TabId): TabMeta {
  const found = TABS.find((one) => one.id === id);
  // `TabId` is derived from `TABS`, so this cannot miss; the fallback exists
  // because `find` is typed as possibly-undefined and a non-null assertion
  // would be a worse way to say the same thing.
  return found ?? TABS[0];
}
