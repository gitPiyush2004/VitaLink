/**
 * The one error type this package throws.
 *
 * It carries the source id and a machine-readable `kind`, because callers act on
 * the difference: an ingestion worker treats `rate_limited` as "back off and try
 * the next scheduled run", while a carrier adapter maps `timeout` onto an
 * `UNAVAILABLE` quote with reason `api_timeout`.
 *
 * The API translates these into its own `AppError` at the boundary. This package
 * deliberately does not import the API's error classes — it must be usable from
 * a worker, from a script, and from a test with no Express in sight.
 */

export const CONNECTOR_ERROR_KINDS = [
  'missing_credentials',
  'rate_limited',
  'timeout',
  'network',
  'bad_request',
  'not_found',
  'upstream_error',
  'malformed_response',
] as const;

export type ConnectorErrorKind = (typeof CONNECTOR_ERROR_KINDS)[number];

export class ConnectorError extends Error {
  readonly kind: ConnectorErrorKind;
  readonly sourceId: string;
  readonly httpStatus: number | null;
  readonly url: string | null;

  constructor(options: {
    kind: ConnectorErrorKind;
    sourceId: string;
    message: string;
    httpStatus?: number | null;
    url?: string | null;
    cause?: unknown;
  }) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ConnectorError';
    this.kind = options.kind;
    this.sourceId = options.sourceId;
    this.httpStatus = options.httpStatus ?? null;
    this.url = options.url ?? null;
  }
}

/** Maps an HTTP status onto the kind a caller can switch on. */
export function kindForStatus(status: number): ConnectorErrorKind {
  const NOT_FOUND = 404;
  const TOO_MANY_REQUESTS = 429;
  const CLIENT_ERROR_FLOOR = 400;
  const SERVER_ERROR_FLOOR = 500;

  if (status === TOO_MANY_REQUESTS) return 'rate_limited';
  if (status === NOT_FOUND) return 'not_found';
  if (status >= SERVER_ERROR_FLOOR) return 'upstream_error';
  if (status >= CLIENT_ERROR_FLOOR) return 'bad_request';
  return 'upstream_error';
}
