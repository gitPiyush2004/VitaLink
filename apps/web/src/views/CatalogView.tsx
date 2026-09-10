/**
 * Stage 3: MAP — the drug catalogue and its redundancy figures.
 *
 * The two columns worth reading carefully are `z_plant` and `z_api`, because
 * they are tagged differently and the difference is the whole point.
 *
 * `z_plant` is DERIVED: it comes from the numbers-equivalent of the
 * Herfindahl-Hirschman index over openFDA's per-labeler product counts, so it is
 * arithmetic on published data.
 *
 * `z_api` is SCENARIO with a value of 1, because **openFDA does not publish the
 * API tier at all**. An earlier version derived it from the labeler count, which
 * produced z_api = 4 for every drug in the catalogue and a fragility index of
 * effectively zero — a number technically derived from real data that meant
 * nothing. The honest answer was to admit the tier is unobserved and say so on
 * the value, which is what `apiTierVisibility: NOT_OBSERVED` records.
 */

import {
  Cell,
  CellStack,
  Empty,
  ErrorNote,
  Panel,
  QuantityValue,
  Row,
  Stat,
  StatGrid,
  Table,
  Tag,
  UnavailableValue,
} from '@vitalink/ui';

import { listDrugs } from '../api/queries';

import { useApi } from './useApi';

export function CatalogView(): React.ReactElement {
  const drugs = useApi(() => listDrugs(), []);
  const rows = drugs.data ?? [];

  const coldChain = rows.filter((one) => one.coldChain).length;
  const singleSource = rows.filter((one) => one.isSingleSource).length;
  const storageParsed = rows.filter((one) => one.temperatureRequirement !== null).length;
  const withProhibitions = rows.filter((one) => one.prohibitedTemperatureRanges.length > 0).length;

  return (
    <>
      <StatGrid>
        <Stat
          label="Drugs in the catalogue"
          value={rows.length}
          note="from live openFDA NDC listings"
          tone="real"
        />
        <Stat
          label="Storage parsed from label"
          value={storageParsed}
          note={`${String(withProhibitions)} have a range the label explicitly forbids`}
          tone="derived"
        />
        <Stat label="Cold chain" value={coldChain} note="2–8 °C or colder" tone="derived" />
        <Stat
          label="Single-source"
          value={singleSource}
          note="one labeler holds effectively all the supply"
          tone="modelled"
        />
      </StatGrid>

      <Panel
        title="Drug catalogue"
        eyebrow="Stage 3"
        subtitle="Storage conditions are parsed from each label's own text; the redundancy figures are derived from per-labeler product counts."
        flush
      >
        {drugs.error !== null ? (
          <div style={{ padding: 18 }}>
            <ErrorNote text={drugs.error} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 18 }}>
            <Empty reason="The catalogue is empty. Run: npm run refresh:catalog --workspace @vitalink/api" />
          </div>
        ) : (
          <Table
            headers={[
              'Medicine',
              'Must be stored at',
              'How many makers',
              'Plant backup (z_plant)',
              'Ingredient backup (z_api)',
              'Supply risk',
            ]}
          >
            {rows.map((drug) => (
              <Row key={drug.id}>
                <Cell>
                  <CellStack primary={drug.genericName} secondary={<code>{drug.id}</code>} />
                </Cell>

                <Cell>
                  {drug.temperatureRequirement === null ? (
                    <UnavailableValue
                      reason={
                        drug.storageParseReason ??
                        'No storage section could be read from the label.'
                      }
                    />
                  ) : (
                    <span
                      title={drug.storageParseReason ?? ''}
                      style={{ cursor: 'help', color: 'var(--vl-ink)', fontWeight: 550 }}
                    >
                      {drug.temperatureRequirement}
                    </span>
                  )}
                  {drug.prohibitedTemperatureRanges.length === 0 ? null : (
                    <span className="vl-cell-sub vl-danger">
                      label FORBIDS {drug.prohibitedTemperatureRanges.join(', ')}
                    </span>
                  )}
                </Cell>

                <Cell>
                  {drug.rawLabelerCount === null ? (
                    <UnavailableValue reason="No labeler count was obtained from openFDA." />
                  ) : (
                    <>
                      <QuantityValue quantity={drug.rawLabelerCount} showTag={false} />
                      {drug.labelerCountWasTruncated ? (
                        <span
                          className="vl-danger"
                          title="openFDA capped the count buckets, so this is a FLOOR rather than a total."
                          style={{ cursor: 'help' }}
                        >
                          {' '}
                          +
                        </span>
                      ) : null}
                      {drug.hhiManufacturers === null ? null : (
                        <span className="vl-cell-sub">
                          HHI <QuantityValue quantity={drug.hhiManufacturers} showTag={false} />
                        </span>
                      )}
                    </>
                  )}
                </Cell>

                <Cell>
                  {drug.zPlant === null ? (
                    <UnavailableValue reason="Not derived: no labeler distribution was obtained." />
                  ) : (
                    <QuantityValue quantity={drug.zPlant} />
                  )}
                </Cell>

                <Cell>
                  {drug.zApi === null ? (
                    <UnavailableValue reason="No API-tier figure at all." />
                  ) : (
                    <>
                      <QuantityValue quantity={drug.zApi} />
                      <span className="vl-cell-sub">{drug.apiTierVisibility}</span>
                    </>
                  )}
                </Cell>

                <Cell nowrap>
                  {drug.isSingleSource ? (
                    <Tag
                      tone="danger"
                      title="One labeler holds effectively all of this drug's supply, by the HHI over per-labeler product counts."
                    >
                      SINGLE SOURCE
                    </Tag>
                  ) : (
                    <Tag tone="real" title="More than one labeler holds meaningful share.">
                      MULTI
                    </Tag>
                  )}
                  {drug.coldChain ? <span className="vl-cell-sub">cold chain</span> : null}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      <Panel
        title="Why z_api is SCENARIO and z_plant is DERIVED"
        eyebrow="The catalogue's most important caveat"
        subtitle="Stated here rather than left in a tooltip, because it is the difference between a fragility index that means something and one that does not."
      >
        <div className="vl-prose">
          <p>
            openFDA publishes who <em>labels</em> a drug, not who makes its active ingredient. Those
            are different echelons of the supply chain, and the API tier is the one that actually
            concentrates — a drug with forty labelers can still depend on two API plants.
          </p>
          <p>
            An earlier version derived <code>z_api</code> from the labeler count. It produced{' '}
            <code>z_api = 4</code> for every drug in the catalogue and a fragility index of
            effectively zero: a number technically derived from real data that meant nothing at all.
          </p>
          <p>
            What the code does now is admit the tier is unobserved, set <code>z_api = 1</code> as
            the conservative assumption, tag it <strong>SCENARIO</strong>, and record{' '}
            <code>api_tier_visibility: NOT_OBSERVED</code> on the drug. The reliability model is
            therefore answering &ldquo;how fragile is this drug <em>if</em> its API comes from one
            plant&rdquo; — a question with an honest answer, rather than a confident one built on a
            fictional input.
          </p>
        </div>
      </Panel>
    </>
  );
}
