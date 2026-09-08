/**
 * CI GATE 5 — no fake live quotes.
 *
 * This gate exists because a fabricated carrier price is the one defect that
 * would invalidate the whole logistics feature, and it is invisible in a demo.
 * Four properties are asserted statically:
 *
 *   (a) CARRIER_MOCK_MODE cannot be true when NODE_ENV=production
 *   (b) no code path can emit quote_status 'LIVE_QUOTE' from the mock adapter or
 *       the rate model
 *   (c) every UNAVAILABLE quote carries a non-null unavailable_reason
 *   (d) every ESTIMATED quote carries a calculation_method and a confidence
 *
 * (c) and (d) are also enforced at parse time by `carrierQuoteSchema`. Two
 * independent mechanisms is the point: the schema catches values at runtime, this
 * catches code that has not run yet.
 */

import { join } from 'node:path';

import { collectFiles, report, violationAt, REPO_ROOT, type Violation } from './gate-lib';

const RULE =
  'A sandbox, estimated or unavailable quote may never be presented as a live one. ' +
  'Mock mode is impossible in production; only a real carrier response with an archived ' +
  'raw payload may be tagged LIVE_QUOTE.';

/** Files that may not contain the string 'LIVE_QUOTE' at all. */
const MUST_NOT_CLAIM_LIVE = [/mock-carrier\.adapter\.ts$/, /rate-model/, /estimated-quote/];

function checkMockCannotClaimLive(): Violation[] {
  const violations: Violation[] = [];
  const files = collectFiles(join(REPO_ROOT, 'packages'), ['.ts']).concat(
    collectFiles(join(REPO_ROOT, 'apps'), ['.ts']),
  );

  for (const file of files) {
    if (!MUST_NOT_CLAIM_LIVE.some((pattern) => pattern.test(file.relativePath))) continue;

    for (const match of file.text.matchAll(/LIVE_QUOTE/g)) {
      violations.push(
        violationAt(file, match.index, 'a mock or modelled source must never claim LIVE_QUOTE'),
      );
    }
  }

  return violations;
}

/**
 * The env schema must contain the production guard.
 *
 * Checking for the guard's presence rather than trying to evaluate it is
 * deliberate: this gate is a grep, and a grep cannot reason. What it can do is
 * fail if somebody deletes the guard, which is the realistic regression.
 */
function checkProductionGuardExists(): Violation[] {
  const envFiles = collectFiles(join(REPO_ROOT, 'apps', 'api', 'src', 'config'), ['env.ts']);
  const envFile = envFiles[0];

  if (envFile === undefined) {
    return [{ file: 'apps/api/src/config/env.ts', line: 1, detail: 'env schema not found' }];
  }

  const hasGuard =
    envFile.text.includes('CARRIER_MOCK_MODE') &&
    envFile.text.includes("NODE_ENV === 'production'");

  return hasGuard
    ? []
    : [
        {
          file: envFile.relativePath,
          line: 1,
          detail:
            'the env schema no longer refuses to boot with CARRIER_MOCK_MODE=true and ' +
            'NODE_ENV=production',
        },
      ];
}

/**
 * The contract must still require a reason on UNAVAILABLE and a confidence on
 * ESTIMATED. Deleting those refinements would silently allow a blank-reason
 * carrier row or a confidence-free estimate.
 */
function checkContractRefinementsExist(): Violation[] {
  const files = collectFiles(join(REPO_ROOT, 'packages', 'contracts', 'src'), ['logistics.ts']);
  const contract = files[0];

  if (contract === undefined) {
    return [{ file: 'packages/contracts/src/logistics.ts', line: 1, detail: 'contract not found' }];
  }

  const required: [string, string][] = [
    ['An UNAVAILABLE quote must say why', 'the UNAVAILABLE-needs-a-reason refinement'],
    ['An ESTIMATED price must publish its confidence', 'the ESTIMATED-needs-confidence refinement'],
    ['must reference the archived carrier payload', 'the LIVE_QUOTE-needs-proof refinement'],
    ['price is tagged SCENARIO', 'the SANDBOX_QUOTE-is-not-real-pricing refinement'],
  ];

  return required
    .filter(([needle]) => !contract.text.includes(needle))
    .map(([, description]) => ({
      file: contract.relativePath,
      line: 1,
      detail: `${description} has been removed`,
    }));
}

report('gate 5 — no fake live quotes', RULE, [
  ...checkMockCannotClaimLive(),
  ...checkProductionGuardExists(),
  ...checkContractRefinementsExist(),
]);
