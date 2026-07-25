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
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return expected;
        },
      },
    },
  );
  const controller = new AbortController();

  const result = await gameApi.getCurrentGame(controller.signal);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v1/games/current');
  assert.equal(calls[0].init.signal, controller.signal);
  assert.deepEqual(result, expected);
});

test('join preflight uses the authenticated v1 route with a stable idempotency key', async () => {
  const calls = [];
  const previousDocument = globalThis.document;
  globalThis.document = { cookie: 'adx_csrf=csrf-test-value' };
  try {
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': {
          arenaApiRequest: async (path, init) => {
            calls.push({ path, init });
            return { joinAuthorizationId: 'ja:test' };
          },
        },
      },
    );

    await gameApi.getJoinPreflight('game/current', 'agent:one', 'join-key-1');

    assert.equal(calls[0].path, '/api/v1/games/game%2Fcurrent/join-preflight');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-key-1');
    assert.equal(calls[0].init.headers['X-CSRF-Token'], 'csrf-test-value');
    assert.equal(calls[0].init.body, JSON.stringify({ agentId: 'agent:one' }));
  } finally {
    globalThis.document = previousDocument;
  }
});

test('joining sends the locked portfolio through the formal v1 contract', async () => {
  const calls = [];
  const previousDocument = globalThis.document;
  globalThis.document = { cookie: 'adx_csrf=csrf-test-value' };
  try {
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': {
          arenaApiRequest: async (path, init) => {
            calls.push({ path, init });
            return { participantId: 'participant:test' };
          },
        },
      },
    );
    const payload = {
      agentId: 'agent:test',
      joinAuthorizationId: 'ja:test',
      paymentMandateId: 'pm:test',
      portfolio: {
        cash: '2',
        holdings: { grain: 2, iron: 1, warhorse: 0, gems: 3 },
      },
    };

    await gameApi.joinCurrentGame('game:test', payload, 'join-final-key');

    assert.equal(calls[0].path, '/api/v1/games/game%3Atest/participants');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-final-key');
    assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('join preflight readiness requires every server gate and no safe refusal code', () => {
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async () => {
          throw new Error('not called');
        },
      },
    },
  );
  const ready = {
    eligible: true,
    readyToJoin: true,
    safeErrorCode: null,
  };

  assert.equal(gameApi.isJoinPreflightReady(ready), true);
  assert.equal(gameApi.isJoinPreflightReady({ ...ready, eligible: false }), false);
  assert.equal(gameApi.isJoinPreflightReady({ ...ready, readyToJoin: false }), false);
  assert.equal(
    gameApi.isJoinPreflightReady({ ...ready, safeErrorCode: 'runtime_not_ready' }),
    false,
  );
});

test('payment mandate creation stays scoped to the game authorization', async () => {
  const calls = [];
  const previousDocument = globalThis.document;
  globalThis.document = { cookie: 'adx_csrf=csrf-test-value' };
  try {
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': {
          arenaApiRequest: async (path, init) => {
            calls.push({ path, init });
            return { mandate: { mandateId: 'pm:test' } };
          },
        },
      },
    );
    const payload = {
      mandateId: 'pm:test',
      gameId: 'game:test',
      joinAuthorizationId: 'ja:test',
      chainId: 1439,
      tokenAddress: `0x${'1'.repeat(40)}`,
      maxPerPaymentAtomic: '10000000',
      maxCumulativeAtomic: '50000000',
      allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT',
      validFrom: '2026-07-26T00:00:00.000Z',
      expiresAt: '2026-07-26T02:00:00.000Z',
    };

    await gameApi.createPaymentMandate(payload, 'mandate-key-1');

    assert.equal(calls[0].path, '/api/v1/me/payment-mandates');
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'mandate-key-1');
    assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('withdrawal uses the owner-scoped v1 participant route', async () => {
  const calls = [];
  const previousDocument = globalThis.document;
  globalThis.document = { cookie: 'adx_csrf=csrf-test-value' };
  try {
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': {
          arenaApiRequest: async (path, init) => {
            calls.push({ path, init });
            return { status: 'WITHDRAWN' };
          },
        },
      },
    );

    await gameApi.withdrawCurrentGameParticipant(
      'game:test',
      'participant:test',
      'withdraw-key-1',
    );

    assert.equal(
      calls[0].path,
      '/api/v1/games/game%3Atest/participants/participant%3Atest',
    );
    assert.equal(calls[0].init.method, 'DELETE');
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'withdraw-key-1');
  } finally {
    globalThis.document = previousDocument;
  }
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
