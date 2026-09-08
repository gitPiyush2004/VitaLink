/**
 * MAP (spec stage 3).
 *
 * The graph is built live from public data and never contains an invented edge.
 * The `drug` node is the bridge between the regulatory plane (country ->
 * ingredient -> drug -> manufacturer -> facility) and the physical plane (drug ->
 * hub -> lane -> hospital -> district). That bridge is what lets a country-level
 * export shock reach a district-level population.
 */

import { z } from 'zod';

import { geoPointSchema, idSchema } from './common';
import { edgeRelationSchema, nodeTypeSchema } from './enums';
import { provenanceSchema, quantitySchema } from './provenance';

export const graphNodeSchema = z.object({
  id: idSchema,
  type: nodeTypeSchema,
  label: z.string().min(1),
  /** Type-specific denormalised attributes, kept small: traversal reads these. */
  attrs: z.record(z.string(), z.unknown()),
  point: geoPointSchema.nullable(),
  provenance: provenanceSchema,
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: idSchema,
  src: idSchema,
  dst: idSchema,
  rel: edgeRelationSchema,
  /**
   * 0..1. Its meaning depends on the relation and is stated in
   * `weight.provenance.calculation_method` on every single edge:
   *   SOURCED_FROM -> real trade import share (a probability, not a contract)
   *   MADE_BY      -> share of observed NDC products for that drug
   *   others       -> 1 where the relation is structural rather than weighted
   */
  weight: quantitySchema,
  provenance: provenanceSchema,
});
export type GraphEdge = z.infer<typeof graphEdgeSchema>;

/** Per-drug structural metrics computed from the graph, used by TRACE and QUANTIFY. */
export const drugGraphMetricsSchema = z.object({
  drug_id: idSchema,
  /** Herfindahl-Hirschman index over the drug's manufacturers. 0..1, 1 = single maker. */
  hhi_manufacturers: quantitySchema,
  distinct_manufacturer_count: quantitySchema,
  distinct_facility_count: quantitySchema,
  /** True when only one manufacturer was observed. This is what z_api == 1 means. */
  is_single_source: z.boolean(),
  /** Largest single-country import share across the drug's ingredients. */
  max_country_dependency_share: quantitySchema.nullable(),
  provenance: provenanceSchema,
});
export type DrugGraphMetrics = z.infer<typeof drugGraphMetricsSchema>;

/** One hop in a propagation path. Rendered as a clickable chain in the UI. */
export const pathHopSchema = z.object({
  from_node_id: idSchema,
  to_node_id: idSchema,
  rel: edgeRelationSchema,
  weight: z.number().min(0).max(1),
  from_label: z.string(),
  to_label: z.string(),
});
export type PathHop = z.infer<typeof pathHopSchema>;

export const propagationPathSchema = z.object({
  hops: z.array(pathHopSchema).min(1),
  /** Product of the hop weights. The multiplicative term in the exposure formula. */
  path_weight: z.number().min(0).max(1),
  length: z.number().int().min(1),
});
export type PropagationPath = z.infer<typeof propagationPathSchema>;
