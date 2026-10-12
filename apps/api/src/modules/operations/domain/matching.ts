import type { Incident, IncidentMatch, Watch } from '@vitalink/contracts';

import type { DrugEntity, ManufacturerEntity } from '@modules/catalog';

export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function productReason(kind: Incident['kind']): string {
  return kind === 'RECALL'
    ? 'FDA product NDC matches a catalogue product. Recall scope remains limited to the reported lots.'
    : 'FDA product NDC matches a catalogue product. Availability applies to the reported presentation; check strength and formulation before acting.';
}
export function matchIncident(
  incident: Incident,
  drug: DrugEntity,
  manufacturers: ManufacturerEntity[],
): IncidentMatch | null {
  const common = { drugId: drug.id, label: drug.genericName };
  if (incident.productNdcs.some((ndc) => drug.ndcProductCodes.includes(ndc))) {
    return {
      ...common,
      kind: 'product',
      directlyIdentified: true,
      reason: productReason(incident.kind),
    };
  }
  if (incident.genericNames.some((name) => normalise(name) === normalise(drug.genericName))) {
    return {
      ...common,
      kind: 'generic',
      directlyIdentified: false,
      reason:
        'Exact generic-name match. Formulation, strength and lot applicability still require review.',
    };
  }
  if (incident.substances.some((name) => normalise(name) === normalise(drug.genericName))) {
    return {
      ...common,
      kind: 'ingredient',
      directlyIdentified: false,
      reason:
        'Shared ingredient reported by FDA. This is a relationship, not confirmation that this product is disrupted.',
    };
  }
  const company = normalise(incident.company);
  if (
    manufacturers.some(
      (maker) => drug.manufacturerIds.includes(maker.id) && normalise(maker.nameRaw) === company,
    )
  ) {
    return {
      ...common,
      kind: 'company',
      directlyIdentified: false,
      reason:
        'Same labeler/recalling firm. Other products are linked for investigation; they are not declared recalled.',
    };
  }
  return null;
}
export function matchesWatch(incident: Incident, watch: Watch): boolean {
  const field =
    watch.kind === 'company'
      ? incident.company
      : [incident.product, ...incident.genericNames, ...incident.substances].join(' ');
  return ` ${normalise(field)} `.includes(` ${normalise(watch.term)} `);
}
