/**
 * Thin controllers: read validated input, call the service, shape the response.
 *
 * One rule is enforced here rather than trusted: the response never contains a
 * carrier credential. It cannot, because nothing in `RecommendationRecord` holds
 * one — the secrets live in `shared/connectors/carriers.ts` and are handed to
 * adapter constructors. `raw_response_ref` is a reference, not a payload. Spec
 * 6.15.
 */

import type { Request, RequestHandler, Response } from 'express';

import type { Place } from '@vitalink/contracts';

import { NotFoundError, UnauthenticatedError } from '@shared/errors';
import { sendCreated, sendOk } from '@shared/http';

import type { ConsignmentInput } from './domain/shipment-derivation';
import type {
  ListLogisticsQuery,
  PlaceBody,
  RecommendFromCascadeBody,
  RerunBody,
  ShipmentParams,
  UrgencyPreviewQuery,
} from './logistics.schema';
import type { LogisticsService } from './logistics.service';

export type LogisticsController = {
  recommendFromCascade: RequestHandler;
  rerun: RequestHandler;
  getShipment: RequestHandler;
  listShipments: RequestHandler;
  getRecommendation: RequestHandler;
  listRecommendations: RequestHandler;
  listCarriers: RequestHandler;
  previewUrgency: RequestHandler;
};

/**
 * Turns a request-body place into a domain `Place`.
 *
 * The provenance says the operator supplied it, which is the truth: the physical
 * layer is not ingested, so a facility's coordinates come from whoever typed
 * them. Attributing them to a geocoder would be a fabricated source.
 */
function toPlace(body: PlaceBody, at: string): Place {
  return {
    name: body.name,
    city: body.city,
    country: body.country,
    ...(body.pincode === undefined ? {} : { pincode: body.pincode }),
    point: body.point === null ? null : { type: 'Point', coordinates: body.point },
    provenance: {
      source_name: 'Operator-supplied location',
      source_url:
        'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/BUILD_LOG.md#physical-layer',
      query: null,
      fetched_at: at,
      calculation_method:
        'Supplied with the shipment request. The physical layer (geocoded facilities, hubs, ' +
        'lanes) is not ingested in the MVP, so this is not a looked-up location.',
    },
  };
}

/**
 * The request body's consignment, in the domain's terms.
 *
 * A straight rename with no defaults applied, which is the point: every field
 * here is required by the schema because no source states any of them.
 */
function toConsignment(
  body: RecommendFromCascadeBody['consignment'],
  at: string,
): ConsignmentInput {
  return {
    origin: toPlace(body.origin, at),
    destination: toPlace(body.destination, at),
    hubIdDestination: body.hub_id_destination,
    weightKg: body.weight_kg,
    dimensionsCm: body.dimensions_cm,
    numberOfPackages: body.number_of_packages,
    affectedPopulation: body.affected_population,
    budgetCeilingInr: body.budget_ceiling_inr,
  };
}

/** The two commands: derive-and-recommend, and re-run under new constraints. */
function createCommands(
  service: LogisticsService,
): Pick<LogisticsController, 'recommendFromCascade' | 'rerun'> {
  return {
    async recommendFromCascade(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const body = req.body as RecommendFromCascadeBody;
      const at = new Date().toISOString();

      sendCreated(
        res,
        await service.recommendFromCascade({
          orgId: req.auth.org,
          cascadeId: body.cascade_id,
          drugId: body.drug_id,
          consignment: toConsignment(body.consignment, at),
          ...(body.preference === undefined ? {} : { preference: body.preference }),
          ...(body.urgency_override === undefined
            ? {}
            : { urgencyOverride: body.urgency_override }),
        }),
      );
    },

    async rerun(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as ShipmentParams;
      const body = req.body as RerunBody;

      sendCreated(
        res,
        await service.rerun({
          orgId: req.auth.org,
          shipmentId: id,
          // Spread rather than assign: `undefined` means "leave unchanged" and
          // `null` means "remove the ceiling", and those are different requests.
          ...(body.budget_ceiling_inr === undefined
            ? {}
            : { budgetCeilingInr: body.budget_ceiling_inr }),
          ...(body.urgency_override === undefined
            ? {}
            : { urgencyOverride: body.urgency_override }),
          ...(body.preference === undefined ? {} : { preference: body.preference }),
        }),
      );
    },
  };
}

/** The reads. Every one is org-scoped except the carrier roster — see below. */
function createQueries(
  service: LogisticsService,
): Omit<LogisticsController, 'recommendFromCascade' | 'rerun'> {
  return {
    async getShipment(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as ShipmentParams;

      const shipment = await service.getShipment(req.auth.org, id);
      if (shipment === null) throw new NotFoundError('Shipment request', id);

      sendOk(res, shipment);
    },

    async listShipments(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListLogisticsQuery;

      sendOk(res, await service.listShipments(req.auth.org, query.limit));
    },

    async getRecommendation(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as ShipmentParams;

      const recommendation = await service.getRecommendation(req.auth.org, id);
      if (recommendation === null) throw new NotFoundError('Logistics recommendation', id);

      sendOk(res, recommendation);
    },

    async listRecommendations(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListLogisticsQuery;

      sendOk(res, await service.listRecommendations(req.auth.org, query.limit));
    },

    async listCarriers(_req: Request, res: Response): Promise<void> {
      // No org scoping: the carrier roster and its documented capabilities are
      // the same for every tenant, and none of it is tenant data.
      sendOk(res, await service.listCarriers());
    },

    async previewUrgency(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as UrgencyPreviewQuery;

      sendOk(res, await service.previewUrgency(req.auth.org, query.cascade_id, query.drug_id));
    },
  };
}

export function createLogisticsController(service: LogisticsService): LogisticsController {
  return { ...createCommands(service), ...createQueries(service) };
}
