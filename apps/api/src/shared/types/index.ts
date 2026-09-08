/**
 * Re-exports the shapes the API layer uses most, so a module imports from one
 * place rather than reaching across the monorepo for each type.
 */

export type {
  ApiError,
  ApiResponse,
  Band,
  ErrorCode,
  PageMeta,
  Provenance,
  ProvenanceTag,
  Quantity,
  Role,
  Scope,
} from '@vitalink/contracts';
