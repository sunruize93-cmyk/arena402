import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTypeScriptModule(path) {
  const filePath = path instanceof URL ? fileURLToPath(path) : path;
  const source = readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', compiled)(
    undefined,
    module,
    module.exports,
  );
  return module.exports;
}

test('reputation formats only server basis points with a non-zero denominator', () => {
  const { formatSuccessRate } = loadTypeScriptModule(
    new URL('../src/lib/reputation.ts', import.meta.url),
  );

  assert.equal(formatSuccessRate(7917, 24), '79.17%');
  assert.equal(formatSuccessRate(0, 1), '0.00%');
  assert.equal(formatSuccessRate(0, 0), '—');
  assert.equal(formatSuccessRate(null, 0), '—');
});
