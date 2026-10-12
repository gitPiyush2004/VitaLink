import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';
import ts from 'typescript';

// Source is parsed, never executed. Secrets and ignored runtime files are not
// inventoried. Generated context is excluded to avoid recursive documentation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vault = path.join(root, 'docs/context');
const check = process.argv.includes('--check');
const roles = JSON.parse(fs.readFileSync(path.join(root, 'scripts/docs/roles.json'), 'utf8'));
const inventory = [
  ...new Set(
    execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(
        (file) => file && !file.startsWith('docs/context/') && fs.existsSync(path.join(root, file)),
      ),
  ),
].sort();
const known = new Set(inventory);
const options = await prettier.resolveConfig(path.join(root, 'README.md'));
// Obsidian ignores dot-prefixed files, so root dotfiles need visible note names.
const cardName = (file) =>
  `${file.startsWith('.') ? 'root--' : ''}${file.replaceAll('/', '--')}.md`;
const link = (file) => `[${file}](./${encodeURI(cardName(file))})`;
const sourceUrl = (file) =>
  `https://github.com/gitPiyush2004/VitaLink/blob/main/${file.split('/').map(encodeURIComponent).join('/')}`;

function component(file) {
  const module = file.match(/^apps\/api\/src\/modules\/([^/]+)\//)?.[1];
  if (module) return module;
  if (file.startsWith('apps/api/src/scripts/')) return 'scripts';
  if (file.startsWith('apps/api/src/')) return 'shared';
  if (file.startsWith('apps/brain/')) return 'brain';
  if (file.startsWith('apps/web/')) return 'web';
  if (file.startsWith('apps/workers/')) return 'workers';
  if (file.startsWith('packages/graph/')) return 'graph-package';
  for (const name of ['contracts', 'connectors', 'ui']) {
    if (file.startsWith(`packages/${name}/`)) return name;
  }
  if (file.startsWith('scripts/')) return 'scripts';
  if (file.startsWith('eval/')) return 'evaluation';
  if (file.startsWith('infra/')) return 'infrastructure';
  if (file.startsWith('docs/')) return 'documentation';
  return 'tooling';
}

function responsibility(file) {
  if (roles.files[file]) return roles.files[file];
  if (/test|__tests__/.test(file)) {
    if (file.includes('/factories/'))
      return 'Constructs test-only inputs; never import these into the runtime public-data workflow.';
    return 'Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.';
  }
  if (file.endsWith('.routes.ts'))
    return 'Declares HTTP paths, scopes and validation for this module; follow controllers for request adaptation.';
  if (file.endsWith('.controller.ts'))
    return 'Adapts validated HTTP requests and authenticated identity to module services and response envelopes.';
  if (file.endsWith('.repository.ts'))
    return 'Owns persistence queries/mapping for this module; follow callers for business decisions and organisation scope.';
  if (file.includes('/models/'))
    return 'Defines storage schemas, indexes or model/document mapping; it does not independently establish the truth of stored evidence.';
  if (file.endsWith('.service.ts'))
    return 'Orchestrates module domain calculations, dependencies and repository calls; follow imports and public methods below.';
  if (file.endsWith('.schema.ts'))
    return 'Validates boundary inputs and rejects malformed domain requests before service work.';
  if (file.endsWith('.types.ts') || file.endsWith('.d.ts'))
    return 'Defines compile-time types/declarations; runtime truth and validation live in schemas and services.';
  if (/index\.(ts|py)$|__init__\.py$/.test(file))
    return 'Provides module/package exports or a package marker; follow re-export dependencies for implementations.';
  if (file.includes('/domain/'))
    return 'Contains deterministic domain logic; inspect the named declarations and tests below for the calculation or matching rule.';
  if (file.endsWith('.tsx'))
    return 'Renders React interface components and associated interactions; follow data/client imports to understand the source of displayed evidence.';
  if (file.endsWith('.css'))
    return 'Defines presentation/layout styles; visual prominence does not change source precision or provenance.';
  if (file.endsWith('.md'))
    return 'Documents this component or decision. Read its headings below and distinguish historical intent from current code.';
  if (file.endsWith('Dockerfile'))
    return 'Defines this process container image and startup; a build recipe alone is not verified container execution.';
  if (file.endsWith('package.json'))
    return 'Declares package scripts, dependencies and entry/type mappings; imported source remains the behavior reference.';
  if (/tsconfig.*\.json$/.test(file))
    return 'Configures TypeScript compilation, type safety and/or workspace path resolution.';
  if (file.endsWith('.sh'))
    return 'Runs a local setup or verification shell workflow; inspect commands before treating it as runtime application behavior.';
  return 'Supports this component through the configuration or source declarations identified below; consult the linked source for full behavior.';
}

const aliasBases = {
  '@config': 'apps/api/src/config',
  '@shared': 'apps/api/src/shared',
  '@modules': 'apps/api/src/modules',
  '@vitalink/contracts': 'packages/contracts/src',
  '@vitalink/connectors': 'packages/connectors/src',
  '@vitalink/graph': 'packages/graph/src',
  '@vitalink/ui': 'packages/ui/src',
};

function resolveImport(file, specifier) {
  let base;
  if (specifier.startsWith('.'))
    base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  for (const [alias, directory] of Object.entries(aliasBases)) {
    if (specifier === alias || specifier.startsWith(`${alias}/`))
      base = `${directory}${specifier.slice(alias.length)}`;
  }
  if (file.endsWith('.py') && specifier.startsWith('app'))
    base = `apps/brain/${specifier.replaceAll('.', '/')}`;
  if (!base) return null;
  return (
    [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.py`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
      `${base}/__init__.py`,
    ].find((candidate) => known.has(candidate)) ?? null
  );
}

const pythonFiles = inventory.filter((file) => file.endsWith('.py'));
const python = pythonFiles.length
  ? JSON.parse(
      execFileSync(
        'python3',
        [
          '-c',
          `
import ast, json, pathlib, sys
result = {}
for name in json.load(sys.stdin):
    tree = ast.parse(pathlib.Path(name).read_text())
    declarations, imports = [], []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            declarations.append({'name': node.name, 'line': node.lineno, 'kind': type(node).__name__})
            if isinstance(node, ast.ClassDef):
                for member in node.body:
                    if isinstance(member, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        declarations.append({'name': node.name + '.' + member.name, 'line': member.lineno, 'kind': 'method'})
        if isinstance(node, ast.Import):
            imports.extend(item.name for item in node.names)
        if isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    result[name] = {'declarations': declarations, 'imports': imports, 'tests': []}
print(json.dumps(result))
`,
        ],
        { cwd: root, input: JSON.stringify(pythonFiles), encoding: 'utf8' },
      ),
    )
  : {};

function structure(file, text) {
  if (python[file]) return python[file];
  const result = { declarations: [], imports: [], tests: [] };
  if (!/\.[cm]?[jt]sx?$/.test(file)) return result;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  for (const statement of source.statements) {
    if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier))
      result.imports.push(statement.moduleSpecifier.text);
    if (statement.name)
      result.declarations.push({
        name: statement.name.getText(source),
        line: line(statement),
        kind: ts.SyntaxKind[statement.kind],
      });
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        result.declarations.push({
          name: declaration.name.getText(source),
          line: line(declaration),
          kind: 'binding',
        });
    }
    if (ts.isClassDeclaration(statement)) {
      for (const member of statement.members) {
        if (ts.isMethodDeclaration(member))
          result.declarations.push({
            name: `${statement.name?.text ?? 'class'}.${member.name.getText(source)}`,
            line: line(member),
            kind: 'method',
          });
      }
    }
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      /^(it|test|describe)(\.(each|skip|only))?$/.test(node.expression.getText(source))
    ) {
      const title = node.arguments[0];
      if (title && ts.isStringLiteralLike(title))
        result.tests.push({ title: title.text, line: line(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  result.imports = [...new Set(result.imports)].sort();
  return result;
}

const records = new Map(
  inventory.map((file) => {
    const bytes = fs.readFileSync(path.join(root, file));
    const text = bytes.toString('utf8');
    const parsed = structure(file, text);
    const deps = [
      ...new Set(parsed.imports.map((specifier) => resolveImport(file, specifier)).filter(Boolean)),
    ].sort();
    return [file, { ...parsed, text, bytes, deps, component: component(file), consumers: [] }];
  }),
);
for (const [file, record] of records) {
  for (const dependency of record.deps) records.get(dependency).consumers.push(file);
}

const expected = new Map();
for (const [file, record] of records) {
  const declarations = record.declarations
    .map(
      (item) =>
        `- \`${item.name}\` — ${item.kind}, [line ${item.line}](${sourceUrl(file)}#L${item.line}).`,
    )
    .join('\n');
  const tests = record.tests
    .map(
      (item) =>
        `- ${item.title.replaceAll('\n', ' ')} ([line ${item.line}](${sourceUrl(file)}#L${item.line})).`,
    )
    .join('\n');
  const headings = file.endsWith('.md')
    ? [...record.text.matchAll(/^#{1,6} (.+)$/gm)].map((match) => `- ${match[1]}`).join('\n')
    : '';
  const configs =
    file.endsWith('.json') && !file.endsWith('package-lock.json')
      ? (() => {
          try {
            return Object.keys(JSON.parse(record.text))
              .map((key) => `\`${key}\``)
              .join(', ');
          } catch {
            return '';
          }
        })()
      : '';
  const text = `---
source: ${JSON.stringify(file)}
component: ${record.component}
generated: true
---

# ${file}

[Source on GitHub](${sourceUrl(file)}) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

${responsibility(file)}

**Component:** ${roles.components[record.component]}

## Source structure

${declarations || (record.bytes.length === 0 ? 'Empty package marker or placeholder.' : 'No TypeScript/Python declarations extracted; inspect the source link for configuration or prose.')}
${headings ? `\nDocument headings:\n\n${headings}\n` : ''}${configs ? `\nTop-level configuration keys: ${configs}.\n` : ''}
## Static dependencies

${record.deps.map((dependency) => `- ${link(dependency)}`).join('\n') || 'No resolved repository source imports.'}

Other import specifiers: ${
    record.imports
      .filter((specifier) => !resolveImport(file, specifier))
      .map((specifier) => `\`${specifier}\``)
      .join(', ') || 'none'
  }.

## Static consumers

${
  record.consumers
    .sort()
    .map((consumer) => `- ${link(consumer)}`)
    .join('\n') ||
  'No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.'
}
${tests ? `\n## Named test cases and groups\n\n${tests}\n` : ''}
## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: \`${createHash('sha256').update(record.bytes).digest('hex')}\`.

Generated by \`npm run docs:context\`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
`;
  expected.set(
    `files/${cardName(file)}`,
    await prettier.format(text, { ...options, parser: 'markdown' }),
  );
}

const groups = [...new Set([...records.values()].map((record) => record.component))].sort();
const index = `# Repository file index

${inventory.length} versionable files outside this vault, each with a source note. Ignored secrets/runtime/dependencies and generated vault files are excluded. Notes include curated responsibility, extracted declarations/tests, static dependencies/consumers and source fingerprints. Coverage is checked by \`npm run docs:context:check\`.

[Start here](00_START_HERE.md) · [Architecture](03_SYSTEM_ARCHITECTURE.md) · [Current state](02_CURRENT_STATE.md) · [Validation](07_LOCAL_SETUP_AND_VALIDATION.md)

${groups
  .map(
    (group) =>
      `## ${group}\n\n${roles.components[group]}\n\n${inventory
        .filter((file) => records.get(file).component === group)
        .map((file) => `- [${file}](files/${encodeURI(cardName(file))})`)
        .join('\n')}`,
  )
  .join('\n\n')}
`;
expected.set('FILE_INDEX.md', await prettier.format(index, { ...options, parser: 'markdown' }));

const errors = [];
fs.mkdirSync(path.join(vault, 'files'), { recursive: true });
for (const [relative, content] of expected) {
  const target = path.join(vault, relative);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content)
      errors.push(`Missing/stale: ${relative}`);
  } else fs.writeFileSync(target, content);
}
for (const existing of fs.readdirSync(path.join(vault, 'files'))) {
  if (!expected.has(`files/${existing}`)) {
    if (check) errors.push(`Extra file note: files/${existing}`);
    else
      throw new Error(
        `Obsolete note files/${existing}; remove it deliberately after checking source deletion/rename.`,
      );
  }
}
function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(name) : entry.name.endsWith('.md') ? [name] : [];
  });
}
for (const note of markdownFiles(vault)) {
  const text = fs.readFileSync(note, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:|^#/.test(target)) continue;
    const relative = decodeURI(target.split('#')[0]);
    if (!fs.existsSync(path.resolve(path.dirname(note), relative)))
      errors.push(`Broken link in ${path.relative(vault, note)}: ${target}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `${check ? 'Verified' : 'Generated'} ${inventory.length} file notes, complete source coverage, fingerprints and local links.`,
  );
