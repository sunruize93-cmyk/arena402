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

test('recommended loadout serializes to exactly 20 gold without floats', () => {
  const { RECOMMENDED_LOADOUT, evaluateInitialLoadout } = loadTypeScriptModule(
    new URL('../src/lib/initial-loadout.ts', import.meta.url),
  );

  const result = evaluateInitialLoadout(RECOMMENDED_LOADOUT);

  assert.equal(result.isValid, true);
  assert.equal(result.holdingsValue, 18);
  assert.equal(result.cash, 2);
  assert.deepEqual(result.portfolio, {
    cashAtomic: '2000000',
    holdings: {
      grain: 2,
      iron: 1,
      warhorse: 0,
      gems: 3,
    },
  });
});

test('an all-cash loadout remains a valid 20 gold portfolio', () => {
  const { emptyInitialLoadout, evaluateInitialLoadout } = loadTypeScriptModule(
    new URL('../src/lib/initial-loadout.ts', import.meta.url),
  );

  const result = evaluateInitialLoadout(emptyInitialLoadout());

  assert.equal(result.isValid, true);
  assert.equal(result.cash, 20);
  assert.equal(result.portfolio.cashAtomic, '20000000');
});

test('a loadout over 20 gold is rejected and cannot be serialized', () => {
  const { evaluateInitialLoadout } = loadTypeScriptModule(
    new URL('../src/lib/initial-loadout.ts', import.meta.url),
  );

  const result = evaluateInitialLoadout({
    grain: 0,
    iron: 1,
    warhorse: 2,
    gems: 0,
  });

  assert.equal(result.isValid, false);
  assert.equal(result.cash, -1);
  assert.equal(result.error, 'over_budget');
  assert.equal(result.portfolio, null);
});

test('negative and fractional quantities are rejected', () => {
  const { evaluateInitialLoadout } = loadTypeScriptModule(
    new URL('../src/lib/initial-loadout.ts', import.meta.url),
  );

  for (const holdings of [
    { grain: -1, iron: 0, warhorse: 0, gems: 0 },
    { grain: 0.5, iron: 0, warhorse: 0, gems: 0 },
  ]) {
    const result = evaluateInitialLoadout(holdings);
    assert.equal(result.isValid, false);
    assert.equal(result.error, 'invalid_quantity');
    assert.equal(result.portfolio, null);
  }
});
