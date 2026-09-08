/**
 * Secret scanning (part of CI gate 5 in the spec's list).
 *
 * A committed credential cannot be un-committed: rewriting history does not help
 * once a repository is public, because the object is already mirrored. So this
 * runs on every commit through the pre-commit hook as well as in CI.
 *
 * The patterns are deliberately conservative. A gate that cries wolf gets
 * disabled, and a disabled gate protects nothing.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { collectFiles, report, violationAt, REPO_ROOT, type Violation } from './gate-lib';

const RULE =
  'No credential may be committed. Secrets come from .env (gitignored) or a secrets manager.';

const SECRET_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: 'private key block' },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, name: 'Anthropic API key' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, name: 'AWS access key id' },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, name: 'GitHub personal access token' },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, name: 'Google API key' },
  {
    pattern: /\bmongodb(?:\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@(?!localhost|mongo[:/])/g,
    name: 'Mongo URI with credentials',
  },
  {
    pattern: /\bredis:\/\/[^:\s'"]*:[^@\s'"]+@(?!localhost|redis[:/])/g,
    name: 'Redis URI with credentials',
  },
];

/**
 * Files that legitimately contain secret-shaped strings.
 * `.env.example` holds empty placeholders; the docs describe the formats.
 */
const ALLOWED = ['.env.example', 'docs/', 'scripts/gates/gate-secrets.ts'];

function checkTrackedFiles(): Violation[] {
  const violations: Violation[] = [];
  const files = [
    ...collectFiles(join(REPO_ROOT, 'apps'), ['.ts', '.tsx', '.py', '.json', '.yml', '.yaml']),
    ...collectFiles(join(REPO_ROOT, 'packages'), ['.ts', '.tsx', '.json']),
    ...collectFiles(join(REPO_ROOT, 'infra'), ['.yml', '.yaml', '.js', '.json']),
    ...collectFiles(join(REPO_ROOT, 'scripts'), ['.ts', '.sh']),
    ...collectFiles(join(REPO_ROOT, 'docs'), ['.md']),
  ].filter((file) => !ALLOWED.some((allowed) => file.relativePath.startsWith(allowed)));

  for (const file of files) {
    for (const { pattern, name } of SECRET_PATTERNS) {
      for (const match of file.text.matchAll(pattern)) {
        violations.push(violationAt(file, match.index, `looks like a ${name}`));
      }
    }
  }

  return violations;
}

/** A committed `.env` is the most common way this goes wrong. */
function checkEnvNotCommitted(): Violation[] {
  const envPath = join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return [];

  const gitignore = collectFiles(REPO_ROOT, ['.gitignore']).find(
    (file) => file.relativePath === '.gitignore',
  );

  if (gitignore !== undefined && gitignore.text.split('\n').includes('.env')) return [];

  return [{ file: '.env', line: 1, detail: '.env exists and is not listed in .gitignore' }];
}

report('gate — secret scan', RULE, [...checkTrackedFiles(), ...checkEnvNotCommitted()]);
