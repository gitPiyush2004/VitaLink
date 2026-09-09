/**
 * Thin controllers. Read validated input, call the service, shape the response.
 */

import type { Request, RequestHandler, Response } from 'express';

import { NotFoundError } from '@shared/errors';
import { buildPage, decodeCursor, sendAccepted, sendOk } from '@shared/http';

import type { DrugParams, ListDrugsQuery, RefreshDrugBody } from './catalog.schema';
import type { CatalogService } from './catalog.service';

export type CatalogController = {
  listDrugs: RequestHandler;
  getDrug: RequestHandler;
  refreshDrug: RequestHandler;
};

export function createCatalogController(service: CatalogService): CatalogController {
  return {
    async listDrugs(req: Request, res: Response): Promise<void> {
      const query = req.query as unknown as ListDrugsQuery;
      // The cursor encodes a position in the sort; a malformed one is treated as
      // "start from the beginning" rather than as an error.
      const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);

      const drugs = await service.listDrugs({
        limit: query.limit,
        cursorId: cursor?.id ?? null,
        nlemCriticalOnly: query.nlem_critical,
        singleSourceOnly: query.single_source,
      });

      // `buildPage` wants `{ id, createdAt }`; a drug entity already has both.
      const page = buildPage(drugs, query.limit);
      sendOk(res, page.items, page.page);
    },

    async getDrug(req: Request, res: Response): Promise<void> {
      const { id } = req.params as unknown as DrugParams;
      const drug = await service.getDrug(id);

      if (drug === null) throw new NotFoundError('Drug', id, 'DRUG_NOT_FOUND');

      // Manufacturers and ingredients are resolved in two batched queries rather
      // than one per id, which is the N+1 problem this endpoint would otherwise
      // have for a drug with 47 labelers.
      const [manufacturers, ingredients] = await Promise.all([
        service.getManufacturers(drug.manufacturerIds),
        service.getIngredients(drug.ingredientIds),
      ]);

      sendOk(res, { drug, manufacturers, ingredients });
    },

    async refreshDrug(req: Request, res: Response): Promise<void> {
      const body = req.body as RefreshDrugBody;
      const outcome = await service.refreshDrug(body.generic_name);

      // 202 rather than 200: the refresh reached openFDA and stored what it
      // found, but `warnings` may say part of it could not be completed.
      sendAccepted(res, outcome);
    },
  };
}
