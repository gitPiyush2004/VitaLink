/**
 * CI GATE 3 — one egress point.
 *
 * The rule (spec Rule 3): every outbound HTTP call goes through
 * `packages/connectors`, which attaches provenance, enforces the per-source rate
 * limit, retries with backoff on 429/5xx, and caches to Redis.
 *
 * This is the gate that keeps Rule 1 true. A `fetch` anywhere else would produce
 * a number with no `fetched_at`, no `source_url` and no rate limiting — and the
 * first two are exactly what the whole project claims to guarantee.
 *
 * ESLint also forbids importing axios/got/undici outside connectors. That covers
 * the libraries; this covers global `fetch`, which has no import to restrict.
 */

import { join } from 'node:path';

import { collectFiles, report, violationAt, REPO_ROOT, type Violation } from './gate-lib';

const RULE =
  'All outbound HTTP must go through packages/connectors. It is the single egress ' +
  'point: it attaches provenance, rate limits per source, backs off on 429/5xx and caches.';

/**
 * Where egress is legal.
 *
 * `apps/web` is exempt because the browser talks to our own API, not to third
 * parties — its fetches are same-origin calls to `/api/v1` and are not
 * data-source egress. `scripts/` and `eval/` are deliberately NOT exempt: the
 * source-probe scripts and the evaluation replay must go through the same cached,
 * provenance-attaching client as everything else, or their results are not
 * comparable with the system's.
 */
const ALLOWED_PREFIXES = ['packages/connectors/', 'apps/web/'];

const HTTP_CALLS = [
  { pattern: /\bfetch\s*\(/g, name: 'fetch(' },
  { pattern: /\bhttps?\.request\s*\(/g, name: 'http.request(' },
  { pattern: /\bhttps?\.get\s*\(/g, name: 'http.get(' },
  {
    pattern: /\brequire\(\s*['"](axios|got|node-fetch|undici|superagent)['"]\s*\)/g,
    name: 'http client require',
  },
  {
    pattern: /from\s+['"](axios|got|node-fetch|undici|superagent)['"]/g,
    name: 'http client import',
  },
];

function isAllowed(relativePath: string): boolean {
  return (
    ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix)) ||
    relativePath.includes('__tests__/') ||
    relativePath.endsWith('.test.ts')
  );
}

function run(): Violation[] {
  const violations: Violation[] = [];
  const files = collectFiles(join(REPO_ROOT, 'apps'), ['.ts', '.tsx'])
    .concat(collectFiles(join(REPO_ROOT, 'packages'), ['.ts', '.tsx']))
    .filter((file) => !isAllowed(file.relativePath));

  for (const file of files) {
    for (const { pattern, name } of HTTP_CALLS) {
      for (const match of file.text.matchAll(pattern)) {
        violations.push(violationAt(file, match.index, `direct HTTP: ${name}`));
      }
    }
  }

  return violations;
}

report('gate 3 — one egress point', RULE, run());
