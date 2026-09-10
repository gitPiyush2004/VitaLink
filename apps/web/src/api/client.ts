/**
 * The one place the browser talks to the API.
 *
 * Every request goes through `request()`, for three reasons that all matter:
 *
 * **The access token lives in memory, not in localStorage.** A token in
 * localStorage is readable by any script on the page, which is the standard XSS
 * escalation. It is held in a module variable here and lost on refresh — the
 * refresh cookie is what survives, and it is `HttpOnly` so no script can read
 * it. See `refreshOnce`.
 *
 * **A 401 is retried exactly once**, after a refresh. Not in a loop: a refresh
 * that fails means the session is genuinely over, and retrying would turn one
 * expired session into an infinite request storm against our own API.
 *
 * **No carrier credential ever reaches this file.** It could not: nothing the
 * API returns contains one. `raw_response_ref` is a reference to an archived
 * payload, not the payload. Spec 6.15, and it is a property of the response
 * shape rather than a rule this client has to remember.
 *
 * Requests are same-origin: Vite proxies `/api` to the API in development, so
 * the refresh cookie's `SameSite=Strict` still applies.
 */

const API_PREFIX = '/api/v1';

/** Held in memory on purpose. See the file header. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** The API's error envelope, as `shared/http` sends it. */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Envelope<T> = { data: T; meta?: unknown };

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  } catch {
    // A non-JSON error body means something upstream of the API answered — a
    // proxy, or the dev server before the API is up. Say that rather than
    // reporting an empty message.
    return new ApiError(
      response.status,
      'non_json_response',
      `The API returned ${String(response.status)} with a body that is not JSON. Is it running ` +
        'on http://localhost:4000?',
    );
  }
}

/**
 * One refresh attempt, shared across concurrent 401s.
 *
 * Without the shared promise, a screen that fires five queries at once would
 * send five refresh requests on token expiry — and since refresh rotates the
 * token, four of them would be replaying a revoked one and would log the user
 * out. The single in-flight promise is what makes concurrent expiry safe.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= (async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) return false;

      const body = (await response.json()) as Envelope<{ access_token: string }>;
      accessToken = body.data.access_token;
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Internal. Set on the single retry after a refresh, to stop a loop. */
  isRetry?: boolean;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(accessToken === null ? {} : { authorization: `Bearer ${accessToken}` }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  const UNAUTHORISED = 401;
  if (response.status === UNAUTHORISED && options.isRetry !== true) {
    const refreshed = await refreshOnce();
    if (refreshed) return request<T>(path, { ...options, isRetry: true });
    accessToken = null;
  }

  if (!response.ok) throw await readError(response);

  const body = (await response.json()) as Envelope<T>;
  return body.data;
}

/**
 * Logs in and keeps the access token in memory.
 *
 * The password never leaves this call. It is not stored, not logged, and not
 * kept in component state after the request resolves.
 */
export async function login(email: string, password: string): Promise<void> {
  const body = await request<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  accessToken = body.access_token;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    accessToken = null;
  }
}

/** Restores a session from the refresh cookie on first load. */
export async function restoreSession(): Promise<boolean> {
  return refreshOnce();
}
