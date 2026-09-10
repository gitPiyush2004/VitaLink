/**
 * Hosts whose TLS handshake is slower than undici's connect ceiling.
 *
 * A whole module for one timeout, because the diagnosis took long enough to be
 * worth writing down. Node's `fetch` aborts a request on the AbortController the
 * client sets, but the TCP+TLS *connect* phase has its own 10-second limit
 * inside undici that an AbortController cannot raise.
 *
 * `api.gdeltproject.org` completes its TLS handshake in about eleven seconds
 * from some networks. Raw TCP connects in 450ms, so it is their negotiation that
 * is slow, not the route. Every GDELT request therefore failed with
 * UND_ERR_CONNECT_TIMEOUT while `curl` on the same machine returned 200 — and
 * the error surfaced as "the host is unreachable", which is a different claim
 * and sent the investigation in the wrong direction twice.
 *
 * Two consequences, both here:
 *
 *   - a raised connect timeout, opted into per source rather than globally,
 *     because a slow handshake is a property of one badly-configured host and
 *     not a reason to let every source hang;
 *   - `isConnectTimeout`, so a connect ceiling is reported as a *timeout* rather
 *     than as a network failure. The two map to different `unavailable_reason`
 *     values on a carrier quote, so the distinction reaches the UI.
 */

import { Agent } from 'undici';

/** Forty-five seconds. Measured against the slowest handshake we have seen. */
const CONNECT_TIMEOUT_MS = 45_000;

/** Whether a thrown fetch was undici giving up on the connect phase. */
export function isConnectTimeout(cause: unknown): boolean {
  const codes = ['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'ETIMEDOUT'];
  let current: unknown = cause;

  // Walk the cause chain: `fetch failed` wraps the real error one or two deep.
  const MAX_CAUSE_DEPTH = 4;
  for (
    let depth = 0;
    depth < MAX_CAUSE_DEPTH && current !== null && current !== undefined;
    depth += 1
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && codes.includes(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * The dispatcher for hosts with a slow TLS handshake. Built once, then reused.
 *
 * Lazily created because most runs never need it, and a connection pool that is
 * never used is still a pool holding sockets open.
 */
let slowAgent: Agent | null = null;

export function slowHandshakeAgent(): Agent {
  slowAgent ??= new Agent({ connect: { timeout: CONNECT_TIMEOUT_MS } });
  return slowAgent;
}
