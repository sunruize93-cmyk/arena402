import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTypeScriptModule(path, dependencies = {}) {
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
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  Function('require', 'module', 'exports', compiled)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

test('Current Game client uses the single public product endpoint', async () => {
  const calls = [];
  const expected = {
    game: {
      gameId: 'game-current',
      status: 'WAITING',
      readyCount: 0,
      startThreshold: 10,
      participants: [],
    },
    nextGamePending: false,
    schemaVersion: 'arena.current-game.v1',
  };
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        API_BASE_URL: 'https://api.arena402.test',
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return expected;
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'csrf-test',
      },
    },
  );
  const controller = new AbortController();

  const result = await gameApi.getCurrentGame(controller.signal);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v1/games/current');
  assert.equal(calls[0].init.signal, controller.signal);
  assert.deepEqual(result, expected);
  assert.equal(
    gameApi.getPawnhouseEventsUrl('game current', 4),
    'https://api.arena402.test/api/v1/pawnhouse/games/game%20current/events?after=4',
  );
});

test('Current Game lobby keeps 404 as a retrying preparation state', () => {
  const source = readFileSync(
    new URL('../src/components/GameLobby.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /current_game_not_found/);
  assert.match(source, /The next table is being prepared/);
  assert.match(source, /window\.setInterval/);
  assert.match(source, /status === 'RUNNING'/);
  assert.match(source, /router\.replace/);
});

test('Live Game viewer uses SSE with a polling fallback', () => {
  const source = readFileSync(
    new URL('../src/components/GameViewer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /new EventSource/);
  assert.match(source, /getPawnhouseEventsUrl/);
  assert.match(source, /addEventListener\('arena'/);
  assert.match(source, /window\.setInterval/);
});
