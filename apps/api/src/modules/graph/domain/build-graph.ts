/**
 * Turning the catalogue into a graph.
 *
 * Pure: catalogue entities in, nodes and edges out. No I/O, so the whole graph
 * construction is testable with literal drug records and no database.
 *
 * The rule this file exists to enforce is spec stage 3's: **never invent an
 * edge.** Every edge here comes from a specific field of a specific record, and
 * its weight's `calculation_method` says which. Where a relation cannot be
 * derived from public data, the edge is simply absent — the graph is smaller and
 * honest rather than larger and decorative.
 *
 * **Every edge is oriented along the direction supply flows**, not along the
 * English reading of its relation name. That distinction matters and is not
 * cosmetic — see the note on `madeByEdges` for the cascade that proved it.
 *
 * What that means in practice for the MVP:
 *
 *   country --SOURCED_FROM--> ingredient   only when UN Comtrade data exists
 *   ingredient --CONTAINED_IN--> drug      from openFDA active_ingredients
 *   manufacturer --MADE_BY--> drug         from openFDA labeler shares
 *   manufacturer --OPERATES--> facility    needs DailyMed SPL; absent for now
 *   drug --STOCKED_AT--> hub               needs OSM warehouses; absent for now
 *
 * The two absent relations are the physical layer's start. Their absence is the
 * reason the MVP's cascade terminates at the drug rather than at a hospital, and
 * that is stated on the cascade result rather than left for a reader to notice.
 *
 * Every node and edge inherits the provenance of the catalogue record it came
 * from — which is why `DrugEntity` and friends expose their own `provenance`.
 * An earlier version reached into whichever `Quantity` happened to be present and
 * fell back to an epoch timestamp when they were all null; a node with no honest
 * provenance should not be constructible at all, so the field is required instead.
 */

import {
  derived,
  type GraphEdge,
  type GraphNode,
  type Provenance,
  type Quantity,
} from '@vitalink/contracts';
import { edgeId, nodeId } from '@vitalink/graph';

import type { DrugEntity, IngredientEntity, ManufacturerEntity } from '@modules/catalog';

/**
 * An edge weight, with the meaning of the number attached to the number.
 *
 * Always `DERIVED`, including for a structural relation whose weight is 1 —
 * because "1" there is itself a derivation from the presence of a field, and
 * saying so is cheaper than explaining later why some edges have a formula and
 * others do not.
 */
function edgeWeight(value: number, provenance: Provenance, method: string): Quantity {
  return derived({
    value,
    unit: null,
    source: {
      name: provenance.source_name,
      url: provenance.source_url,
      query: provenance.query,
      fetchedAt: provenance.fetched_at,
    },
    method,
  });
}

export type BuildInput = {
  drugs: DrugEntity[];
  manufacturers: ManufacturerEntity[];
  ingredients: IngredientEntity[];
  /**
   * Country import shares per ingredient id, when trade data is available.
   * Absent means no `SOURCED_FROM` edges, and the cascade cannot start from a
   * country node — which the graph reports rather than papering over.
   */
  tradeShares?: Map<string, { countryCode: string; countryName: string; share: number }[]>;
};

export type BuildResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Relations that could not be built, and why. Rendered as an empty state. */
  absentRelations: { rel: string; reason: string }[];
};

/**
 * Builds the graph from catalogue records.
 *
 * @param input catalogue entities, plus trade shares when available.
 * @returns nodes, edges, and an explicit list of the relations that are absent.
 */
export function buildGraph(input: BuildInput): BuildResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const absentRelations: BuildResult['absentRelations'] = [];

  const manufacturersById = new Map(input.manufacturers.map((one) => [one.id, one]));

  for (const ingredient of input.ingredients) {
    nodes.push({
      id: ingredient.id,
      type: 'ingredient',
      label: ingredient.nameRaw,
      attrs: { hs_codes: ingredient.hsCodes, unii: ingredient.unii },
      point: null,
      provenance: ingredient.provenance,
    });
  }

  for (const manufacturer of input.manufacturers) {
    nodes.push({
      id: manufacturer.id,
      type: 'manufacturer',
      label: manufacturer.nameRaw,
      attrs: {
        country: manufacturer.country,
        // Named so the UI cannot render it as anything but an index.
        capacity_index: manufacturer.capacityIndex?.value ?? null,
      },
      point: null,
      provenance: manufacturer.provenance,
    });
  }

  for (const drug of input.drugs) {
    nodes.push(drugNode(drug));
    edges.push(...containedInEdges(drug));
    edges.push(...madeByEdges(drug, manufacturersById));
  }

  edges.push(...sourcedFromEdges(input, nodes, absentRelations));

  absentRelations.push(...structurallyAbsentRelations(input));

  return { nodes, edges, absentRelations };
}

/**
 * The relations that cannot be built from what is currently ingested.
 *
 * Returned as data rather than logged, because the UI has to say "no country
 * dependency observed" next to an empty panel. An empty panel with no
 * explanation reads as "no risk", which is the opposite of the truth.
 */
function structurallyAbsentRelations(input: BuildInput): BuildResult['absentRelations'] {
  const absent: BuildResult['absentRelations'] = [];

  if (input.tradeShares === undefined || input.tradeShares.size === 0) {
    absent.push({
      rel: 'SOURCED_FROM',
      reason:
        'No UN Comtrade data is available, so no country-dependency edges exist. A cascade ' +
        'cannot start from a country node until UN_COMTRADE_API_KEY is configured.',
    });
  }

  absent.push(
    {
      rel: 'OPERATES',
      reason:
        'Manufacturer-to-facility edges need registered establishments from DailyMed SPL, ' +
        'which is not yet ingested. Facilities therefore have no coordinates and the map ' +
        'shows no manufacturing sites.',
    },
    {
      rel: 'STOCKED_AT / SHIPS_VIA / DELIVERS_TO / SERVES',
      reason:
        'The physical layer needs OSM warehouses and hospitals plus geocoded lanes, which ' +
        'are not yet ingested. A cascade therefore terminates at the drug rather than at a ' +
        'district population.',
    },
  );

  return absent;
}

function drugNode(drug: DrugEntity): GraphNode {
  return {
    id: drug.id,
    type: 'drug',
    label: drug.genericName,
    attrs: {
      // Denormalised because the exposure formula and the fragility board read
      // them on every traversal, and a join per drug would be an N+1.
      z_api: drug.zApi?.value ?? null,
      z_plant: drug.zPlant?.value ?? null,
      hhi: drug.hhiManufacturers?.value ?? null,
      is_single_source: drug.isSingleSource,
      api_tier_visibility: drug.apiTierVisibility,
      temperature_requirement: drug.temperatureRequirement,
      cold_chain: drug.coldChain,
      nlem_critical: drug.nlemCritical,
    },
    point: null,
    provenance: drug.provenance,
  };
}

/** ingredient --CONTAINED_IN--> drug, from openFDA `active_ingredients`. */
function containedInEdges(drug: DrugEntity): GraphEdge[] {
  const provenance = drug.provenance;

  return drug.ingredientIds.map((ingredientId) => ({
    id: edgeId(ingredientId, 'CONTAINED_IN', drug.id),
    src: ingredientId,
    dst: drug.id,
    rel: 'CONTAINED_IN' as const,
    weight: edgeWeight(
      1,
      provenance,
      'Structural, so the weight is 1: openFDA lists this substance among the product ' +
        'active_ingredients. The relation either holds or the edge is absent.',
    ),
    provenance,
  }));
}

/**
 * manufacturer --MADE_BY--> drug, weighted by observed product-listing share.
 *
 * ## Why this edge points the way it does
 *
 * The spec's stage-3 diagram writes this relation as `drug --MADE_BY-->
 * manufacturer`, which is how the phrase reads in English. **Every edge in this
 * graph is oriented along the direction supply flows**, and supply flows from the
 * manufacturer into the drug — so the edge is stored the other way round.
 *
 * This is not a stylistic choice, and it was found by running a cascade. With the
 * edge stored drug-to-manufacturer, a shock at `manufacturer:hospira-inc`
 * propagated to nothing at all, because forward traversal from a manufacturer had
 * no outbound edge to follow. That is the single most common real disruption:
 * openFDA's enforcement reports name a `recalling_firm`, so a manufacturer is
 * exactly where an alert lands.
 *
 * The alternative — keeping the spec's direction and making the traversal
 * relation-aware, following some relations forward and others backward — would
 * put the flow semantics in the traversal instead of in the data, where nobody
 * reading the graph could see them. Recorded as ADR-0011.
 *
 * The weight is a **share of observed openFDA listings**, not a share of volume
 * and not a contract. The method says so, because a 0.48 on this edge would
 * otherwise read as "48% of supply".
 */
function madeByEdges(
  drug: DrugEntity,
  manufacturersById: Map<string, ManufacturerEntity>,
): GraphEdge[] {
  const relevant = drug.manufacturerIds
    .map((id) => manufacturersById.get(id))
    .filter((one): one is ManufacturerEntity => one !== undefined);

  const total = relevant.reduce((sum, one) => sum + (one.distinctProductCount?.value ?? 0), 0);
  if (total === 0) return [];

  return relevant.map((manufacturer) => {
    const count = manufacturer.distinctProductCount?.value ?? 0;
    const provenance = manufacturer.provenance;

    return {
      id: edgeId(manufacturer.id, 'MADE_BY', drug.id),
      src: manufacturer.id,
      dst: drug.id,
      rel: 'MADE_BY' as const,
      weight: edgeWeight(
        count / total,
        provenance,
        "This labeler's share of the openFDA product listings observed for this generic " +
          'name. A share of OBSERVED LISTINGS, not of volume and not a contracted share.',
      ),
      provenance,
    };
  });
}

/**
 * country --SOURCED_FROM--> ingredient, weighted by real trade import share.
 *
 * This is the edge that stands in for the proprietary multi-tier supplier data
 * arXiv:2601.09680 requires. It is a **probability derived from trade value**,
 * never a supplier relationship, and it is labelled that way here and in the UI.
 */
function sourcedFromEdges(
  input: BuildInput,
  nodes: GraphNode[],
  absentRelations: BuildResult['absentRelations'],
): GraphEdge[] {
  if (input.tradeShares === undefined) return [];

  const edges: GraphEdge[] = [];
  const seenCountries = new Set<string>();

  for (const ingredient of input.ingredients) {
    const shares = input.tradeShares.get(ingredient.id);

    if (shares === undefined || shares.length === 0) {
      absentRelations.push({
        rel: `SOURCED_FROM -> ${ingredient.nameRaw}`,
        reason:
          'No trade data for this ingredient. It has no HS code mapping, so its country ' +
          'dependency is unobserved rather than zero.',
      });
      continue;
    }

    for (const share of shares) {
      const countryId = nodeId('country', share.countryCode);

      if (!seenCountries.has(countryId)) {
        seenCountries.add(countryId);
        nodes.push(countryNode(countryId, share, ingredient.provenance));
      }

      edges.push(dependencyEdge(countryId, ingredient, share.share));
    }
  }

  return edges;
}

function countryNode(
  countryId: string,
  share: { countryCode: string; countryName: string },
  provenance: Provenance,
): GraphNode {
  return {
    id: countryId,
    type: 'country',
    label: share.countryName,
    attrs: { iso_numeric: share.countryCode },
    point: null,
    provenance,
  };
}

function dependencyEdge(countryId: string, ingredient: IngredientEntity, share: number): GraphEdge {
  return {
    id: edgeId(countryId, 'SOURCED_FROM', ingredient.id),
    src: countryId,
    dst: ingredient.id,
    rel: 'SOURCED_FROM',
    weight: edgeWeight(
      share,
      ingredient.provenance,
      "This country's share of India's reported imports for the ingredient's HS code, " +
        'from UN Comtrade. A PROBABILITY of dependency derived from trade value — not a ' +
        'supplier contract and not a volume commitment.',
    ),
    provenance: ingredient.provenance,
  };
}
