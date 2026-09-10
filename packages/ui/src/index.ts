/**
 * Shared React primitives.
 *
 * The important one is `<QuantityValue>`: it takes a `Quantity`, not a number,
 * which is how "a source-less figure cannot render" becomes a type error rather
 * than a code-review comment. `<Stat>` applies the same refusal to the big
 * headline figures — it accepts a value or an `unavailable` reason, never both
 * and never neither.
 *
 * The chips are the second half of the same idea. A screenshot of this UI could
 * end up in a slide deck, so every caveat has to be *on* the number rather than
 * in a legend somewhere else — which is why `SANDBOX` and `NOT ELIGIBLE` are
 * chips beside the value and not colours with a key.
 *
 * The stylesheet is imported here so that any consumer of this package gets the
 * tokens with the components, rather than having to remember a second import
 * that only shows up as an unstyled page.
 */

import './theme.css';

export { BandChart, Meter, MeterList, ScatterChart } from './charts';
export type { ScatterPoint } from './charts';
export {
  EligibilityChip,
  MockModeBanner,
  QuoteStatusChip,
  Tag,
  UnavailableList,
  VeracityChip,
} from './chips';
export { Select, TextField, Toolbar } from './controls';
export type { SelectOption } from './controls';
export {
  Button,
  Cell,
  CellStack,
  COLOURS,
  Disclosure,
  Empty,
  ErrorNote,
  Method,
  Note,
  Panel,
  Pill,
  Row,
  Skeleton,
  Stat,
  StatGrid,
  Table,
  toneVariable,
} from './layout';
export type { PanelProps, StatProps, Tone } from './layout';
export { ProvenanceLegend, ProvenanceTag, QuantityValue, UnavailableValue } from './provenance';
export type { QuantityValueProps } from './provenance';
