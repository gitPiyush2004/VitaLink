/**
 * CI GATE 2 — no fixtures in runtime code.
 *
 * The rule (spec Rule 1): sample data lives only under test directories. If
 * production code can import a fixture, then a demo can silently show a
 * hardcoded number, which is the single most damaging thing this project could
 * do to its own credibility.
 *
 * The one permitted exception is the env-gated `MockCarrierAdapter`, which is
 * covered independently by gate 5 (it can only ever emit SANDBOX_QUOTE, and it
 * cannot be enabled in production).
 */

import { join } from 'node:path';

import { collectFiles, report, violationAt, REPO_ROOT, type Violation } from './gate-lib';

const RULE =
  'Runtime code must not import fixtures, mocks or seed data. Sample data belongs ' +
  'under __tests__/. The only exception is the env-gated MockCarrierAdapter.';

/** Import specifiers that mean "this is not real data". */
const FORBIDDEN_SPECIFIERS = [
  /from\s+['"][^'"]*tests?\/fixtures[^'"]*['"]/g,
  /from\s+['"][^'"]*__tests__[^'"]*['"]/g,
  /from\s+['"][^'"]*\/fixtures?\/[^'"]*['"]/g,
  /from\s+['"][^'"]*\.fixture['"]/g,
  /from\s+['"][^'"]*\/seed[^'"]*['"]/g,
];

/**
 * `mock` is allowed only in the adapter's own file, the package barrel that
 * re-exports it, and where it is explicitly registered — because the mock
 * adapter is a documented, env-gated development affordance rather than hidden
 * sample data.
 */
const MOCK_EXCEPTIONS = [
  'packages/connectors/src/carriers/mock-carrier.adapter.ts',
  'packages/connectors/src/carriers/carrier-registry.ts',
  'packages/connectors/src/carriers/index.ts',
];

const MOCK_IMPORT = /from\s+['"][^'"]*mock[^'"]*['"]/gi;

/**
 * Constructing the mock, which is what actually matters.
 *
 * The import check above cannot see `import { MockCarrierAdapter } from
 * '@vitalink/connectors'` — the specifier has no "mock" in it — so a second rule
 * looks for the construction instead. Only the composition root may do it, and
 * only behind `env.CARRIER_MOCK_MODE`; the adapter's own constructor throws when
 * that flag is off, and `env.ts` refuses to parse a production config with it on.
 */
const MOCK_CONSTRUCTION = /new\s+MockCarrierAdapter\s*\(/g;

const MOCK_CONSTRUCTION_EXCEPTIONS = ['apps/api/src/shared/connectors/carriers.ts'];

function isTestFile(relativePath: string): boolean {
  return (
    relativePath.includes('__tests__/') ||
    relativePath.endsWith('.test.ts') ||
    relativePath.startsWith('scripts/') ||
    relativePath.startsWith('eval/')
  );
}

function run(): Violation[] {
  const violations: Violation[] = [];
  const runtimeFiles = collectFiles(join(REPO_ROOT, 'apps'), ['.ts', '.tsx'])
    .concat(collectFiles(join(REPO_ROOT, 'packages'), ['.ts', '.tsx']))
    .filter((file) => !isTestFile(file.relativePath));

  for (const file of runtimeFiles) {
    for (const pattern of FORBIDDEN_SPECIFIERS) {
      for (const match of file.text.matchAll(pattern)) {
        violations.push(violationAt(file, match.index, `imports sample data: ${match[0].trim()}`));
      }
    }

    if (!MOCK_CONSTRUCTION_EXCEPTIONS.includes(file.relativePath)) {
      for (const match of file.text.matchAll(MOCK_CONSTRUCTION)) {
        violations.push(
          violationAt(
            file,
            match.index,
            'constructs the mock carrier. Only the composition root may, and only behind ' +
              'CARRIER_MOCK_MODE.',
          ),
        );
      }
    }

    if (MOCK_EXCEPTIONS.includes(file.relativePath)) continue;

    for (const match of file.text.matchAll(MOCK_IMPORT)) {
      violations.push(violationAt(file, match.index, `imports a mock: ${match[0].trim()}`));
    }
  }

  return violations;
}

report('gate 2 — no fixtures in runtime', RULE, run());
