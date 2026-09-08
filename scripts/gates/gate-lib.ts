/**
 * Shared plumbing for the CI gates.
 *
 * The gates are deliberately plain Node scripts rather than ESLint rules or
 * tests. Two reasons: they check *properties of the whole repository* rather than
 * of one file, and a reader can run any of them alone and read the source in
 * thirty seconds. A custom ESLint plugin would be more elegant and much harder
 * to explain.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname ?? __dirname, '..', '..');

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.venv',
  '__pycache__',
  '.ruff_cache',
  '.mypy_cache',
]);

export type SourceFile = { path: string; relativePath: string; text: string };

/** Walks a directory tree, skipping build output and virtualenvs. */
export function collectFiles(root: string, extensions: string[]): SourceFile[] {
  const found: SourceFile[] = [];

  const walk = (directory: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(directory);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry)) continue;
      const full = join(directory, entry);
      const stats = statSync(full);

      if (stats.isDirectory()) {
        walk(full);
      } else if (extensions.some((extension) => entry.endsWith(extension))) {
        found.push({
          path: full,
          relativePath: relative(REPO_ROOT, full).split(sep).join('/'),
          text: readFileSync(full, 'utf8'),
        });
      }
    }
  };

  walk(root);
  return found;
}

export type Violation = { file: string; line: number; detail: string };

/** Reports a violation with a 1-indexed line number, so an editor can jump to it. */
export function violationAt(file: SourceFile, index: number, detail: string): Violation {
  const line = file.text.slice(0, index).split('\n').length;
  return { file: file.relativePath, line, detail };
}

export function report(gateName: string, rule: string, violations: Violation[]): void {
  if (violations.length === 0) {
    console.log(`PASS  ${gateName}`);
    return;
  }

  console.error(`FAIL  ${gateName}\n\n  ${rule}\n`);
  for (const violation of violations) {
    console.error(`  ${violation.file}:${String(violation.line)}  ${violation.detail}`);
  }

  console.error(`\n  ${String(violations.length)} violation(s).`);
  process.exit(1);
}
