import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
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

test('preseason standings are deterministic and explicitly non-authoritative', async () => {
  const {
    DEMO_FINAL_GAME_STATE,
    DEMO_FINAL_PRICES,
    DEMO_SEASON_STANDINGS,
  } = loadTypeScriptModule(
    new URL('../src/lib/rankings-demo.ts', import.meta.url),
  );

  assert.equal(DEMO_SEASON_STANDINGS.length, 8);
  assert.deepEqual(
    DEMO_SEASON_STANDINGS.map((row) => row.rank),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(
    new Set(DEMO_SEASON_STANDINGS.map((row) => row.agentId)).size,
    DEMO_SEASON_STANDINGS.length,
  );
  assert.deepEqual(DEMO_FINAL_GAME_STATE.finalPrices, DEMO_FINAL_PRICES);

  const source = await readFile(
    new URL('../src/components/SeasonLedger.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /Presentation preview/);
  assert.match(source, /not official\s+season records/);
  assert.match(source, /\/broadcast\/demo/);
  assert.match(source, /\/game\/demo\/result/);
});

test('the primary navigation exposes the rankings page', async () => {
  const source = await readFile(
    new URL('../src/components/SiteHeader.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /\{ href: '\/rankings', label: 'Rankings' \}/);
});

test('the account dropdown survives mixed navigation bundle versions', async () => {
  const [headerSource, designCss, integrationCss] = await Promise.all([
    readFile(
      new URL('../src/components/SiteHeader.tsx', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../src/app/arena402-design.css', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../src/app/arena402-integration.css', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(headerSource, /className="nav-user nav-session"/);
  assert.match(
    headerSource,
    /className="nav-user-menu nav-session-menu"/,
  );
  assert.match(
    headerSource,
    /className="nav-user-meta nav-user-meta-name"/,
  );
  assert.match(headerSource, /className="nav-user-item"/);
  assert.match(headerSource, /className="nav-user-item danger"/);

  assert.match(designCss, /\.nav-user-menu\s*,\s*\.nav-session-menu\s*\{/);
  assert.match(designCss, /\.nav-session-menu > p\s*\{/);
  assert.match(
    designCss,
    /\.nav-user-item\s*,\s*\.nav-session-menu > a\s*,\s*\.nav-session-menu > button\s*\{/,
  );
  assert.doesNotMatch(integrationCss, /\.nav-session-menu\s*\{/);
});
