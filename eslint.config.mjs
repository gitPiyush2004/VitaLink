// ESLint 9 flat config.
//
// This file is where the PART 3A architecture rules stop being aspirational and
// become mechanical. The two rules that matter most are:
//
//   1. `no-restricted-imports` on `**/models/*`  -> only repositories may touch Mongoose.
//   2. `no-restricted-imports` on other modules' internals -> cross-module access
//      goes through the other module's service, never its repository or domain.
//
// If either of those is ever relaxed, the layered architecture is decorative.

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers that are allowed to import a Mongoose model. Nothing else is. */
const REPOSITORY_FILES = ['**/*.repository.ts', '**/repositories/**/*.ts', '**/models/**/*.ts'];

/** Where outbound HTTP is legal. Enforced again, independently, by CI gate 3. */
const EGRESS_FILES = ['packages/connectors/**/*.ts'];

const MODEL_IMPORT_MESSAGE =
  'Mongoose models may only be imported from a repository. Services and controllers ' +
  'must go through the repository so the persistence layer stays swappable.';

const CROSS_MODULE_MESSAGE =
  "Do not reach into another module's internals. Import its `*.service` (or its " +
  '`*.types` / `*.schema`) instead, so module boundaries stay real.';

const HTTP_CLIENT_MESSAGE =
  'All outbound HTTP must go through packages/connectors, which attaches provenance, ' +
  'enforces per-source rate limits and caches. See Rule 3 in the spec.';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/brain/**',
      'eval/notebooks/**',
      // mongosh scripts run inside MongoDB's shell, whose globals (`db`, `print`)
      // are not Node's. Linting them against Node rules only produces noise.
      'infra/mongo-init/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // The type-checked rules need a TypeScript program, which plain JS config
  // files are not part of. Turn them off there rather than adding config files
  // to a tsconfig they have no business being in.
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.config.mts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node, ...globals.commonjs } },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    plugins: { 'import-x': importPlugin },
    rules: {
      // ---- The layering rules -------------------------------------------------
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/models/*', '**/models'], message: MODEL_IMPORT_MESSAGE },
            {
              group: [
                '@modules/*/models/*',
                '@modules/*/*.repository',
                '@modules/*/domain/*',
                '../../modules/*/models/*',
                '../../modules/*/*.repository',
                '../../modules/*/domain/*',
              ],
              message: CROSS_MODULE_MESSAGE,
            },
            {
              group: ['axios', 'got', 'node-fetch', 'undici', 'superagent', 'request'],
              message: HTTP_CLIENT_MESSAGE,
            },
          ],
        },
      ],

      // ---- Type safety -------------------------------------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ---- The async bugs interviewers actually ask about --------------------
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // ---- Readability budgets (PART 3A.12) ----------------------------------
      'no-magic-numbers': [
        'error',
        { ignore: [-1, 0, 1], ignoreArrayIndexes: true, enforceConst: true, detectObjects: false },
      ],
      complexity: ['error', 10],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],

      // ---- Import hygiene ----------------------------------------------------
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@vitalink/**', group: 'internal', position: 'before' },
            { pattern: '@config/**', group: 'internal' },
            { pattern: '@shared/**', group: 'internal' },
            { pattern: '@modules/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-default-export': 'error',

      // ---- General ------------------------------------------------------------
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      // Immutability in business logic (PART 3A.5 rule 12) — but Express
      // middleware's entire contract is decorating `req`, so those two are
      // exempt. Everywhere else, mutating a parameter is an error.
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['req', 'res'] },
      ],
      'prefer-const': 'error',
      curly: ['error', 'multi-line'],
    },
  },

  // Repositories and model files are the one place Mongoose is legal.
  {
    files: REPOSITORY_FILES,
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  // packages/connectors is the single egress point, so HTTP clients are legal there.
  {
    files: EGRESS_FILES,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/models/*', '**/models'], message: MODEL_IMPORT_MESSAGE }] },
      ],
    },
  },

  // Config files declare the named constants, so magic numbers are the point there.
  {
    files: ['**/config/**/*.ts', '**/*.config.ts', '*.mjs', '*.cjs'],
    rules: { 'no-magic-numbers': 'off', 'import-x/no-default-export': 'off' },
  },

  // Tests get to use literal numbers, long files, and default exports freely.
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', 'scripts/**/*.ts', 'eval/**/*.ts'],
    rules: {
      'no-magic-numbers': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-restricted-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },

  // Vite/React entrypoints legitimately use default exports and browser globals.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'import-x/no-default-export': 'off',
      'no-magic-numbers': 'off',
    },
  },

  // Declaration-merging into another package's namespace requires `interface`;
  // `type` cannot do it. This is the one place the rule has to yield.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      'import-x/order': 'off',
    },
  },
);
