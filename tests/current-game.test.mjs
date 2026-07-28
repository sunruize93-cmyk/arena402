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

test('join preflight uses the authenticated v1 route with a stable idempotency key', async () => {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return { joinAuthorizationId: 'ja:test' };
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
      },
    },
  );

  await gameApi.getJoinPreflight('game/current', 'agent:one', 'join-key-1');

  assert.equal(calls[0].path, '/api/v1/games/game%2Fcurrent/join-preflight');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-key-1');
  assert.equal(calls[0].init.headers['X-CSRF-Token'], 'session-csrf-token');
  assert.equal(calls[0].init.body, JSON.stringify({ agentId: 'agent:one' }));
});

test('joining sends the locked portfolio through the formal v1 contract', async () => {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return { participantId: 'participant:test' };
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
      },
    },
  );
  const payload = {
    agentId: 'agent:test',
    joinAuthorizationId: 'ja:test',
    paymentMandateId: 'pm:test',
    portfolio: {
      cashAtomic: '2000000',
      holdings: { grain: 2, iron: 1, warhorse: 0, gems: 3 },
    },
  };

  await gameApi.joinCurrentGame('game:test', payload, 'join-final-key');

  assert.equal(calls[0].path, '/api/v1/games/game%3Atest/participants');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-final-key');
  assert.equal(calls[0].init.headers['X-CSRF-Token'], 'session-csrf-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
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
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
      },
    },
  );
  const ready = {
    eligible: true,
    readyToJoin: true,
    joinAuthorizationId: 'join-authorization',
    checks: {
      game: 'READY',
      agent: 'READY',
      runtime: 'READY',
      wallet: 'READY',
      paymentMandate: 'ACTION_REQUIRED',
    },
    safeErrorCode: null,
    schemaVersion: 'arena.game-join-preflight.v1',
  };

  assert.equal(gameApi.isJoinPreflightReady(ready), true);
  assert.equal(gameApi.isJoinPreflightReady({ ...ready, eligible: false }), false);
  assert.equal(gameApi.isJoinPreflightReady({ ...ready, readyToJoin: false }), false);
  assert.equal(
    gameApi.isJoinPreflightReady({ ...ready, safeErrorCode: 'runtime_not_ready' }),
    false,
  );
  assert.equal(
    gameApi.isJoinPreflightReady({
      ...ready,
      eligible: undefined,
      readyToJoin: undefined,
    }),
    true,
  );
  assert.equal(
    gameApi.isJoinPreflightReady({
      ...ready,
      eligible: undefined,
      readyToJoin: undefined,
      joinAuthorizationId: '',
    }),
    false,
  );
  assert.equal(
    gameApi.isJoinPreflightReady({
      ...ready,
      eligible: undefined,
      readyToJoin: undefined,
      checks: { ...ready.checks, runtime: 'NOT_READY' },
    }),
    false,
  );
});

test('payment mandate creation stays scoped to the game authorization', async () => {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return { mandate: { mandateId: 'pm:test' } };
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
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
  assert.equal(calls[0].init.headers['X-CSRF-Token'], 'session-csrf-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
});

test('current game mandate creation sends its stable idempotency key', async () => {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return { mandate: { mandateId: 'mandate-stable' } };
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
      },
    },
  );

  await gameApi.createCurrentGameMandate(
    'game:test',
    {
      joinAuthorizationId: 'ja:test',
      mandateRequirements: {
        chainId: 1439,
        tokenAddress: `0x${'1'.repeat(40)}`,
        maxPerPaymentAtomic: '10000000',
        maxCumulativeAtomic: '50000000',
        allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT',
        expiresAt: '2026-07-26T02:00:00.000Z',
      },
    },
    'mandate-stable',
  );

  assert.equal(
    calls[0].init.headers['Idempotency-Key'],
    'mandate-stable',
  );
});

test('withdrawal uses the owner-scoped v1 participant route', async () => {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        arenaApiRequest: async (path, init) => {
          calls.push({ path, init });
          return { status: 'WITHDRAWN' };
        },
      },
      '@/lib/connector-api': {
        getConnectorCsrfToken: async () => 'session-csrf-token',
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
  assert.equal(calls[0].init.headers['X-CSRF-Token'], 'session-csrf-token');
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
  assert.match(source, /Join matchmaking/);
  assert.match(source, /Review my ready seat/);
  assert.match(source, /View waiting room/);
  assert.match(source, /Opening the waiting room does not reserve a seat/);
  assert.match(source, /setEntryOpen\(true\)/);
  assert.match(source, /function viewCurrentGame/);
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
  assert.match(source, /Date\.now\(\) - lastEventAt < 5_000/);
  assert.match(source, /startStaleWatch\(\)/);
  assert.match(source, /void refreshAll\(\)/);
});

test('Live Game viewer clears the previous game projection before loading another game', () => {
  const source = readFileSync(
    new URL('../src/components/GameViewer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /setLiveState\(null\)/);
  assert.match(source, /setLiveEvents\(\[\]\)/);
  assert.match(source, /setCurrentGame\(null\)/);
  assert.match(source, /setCurrentProjection\(null\)/);
  assert.match(source, /setMyParticipantId\(''\)/);
  assert.match(
    source,
    /current\?\.game\.gameId === gameId[\s\S]*setCurrentProjection\(current\.game\)[\s\S]*setCurrentProjection\(null\)/,
  );
});

test('Play resets the joined stage when the current game has no participation', () => {
  const source = readFileSync(
    new URL('../src/components/PlayJourney.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /setJoinStage\(currentParticipation \? 'joined' : 'idle'\)/,
  );
  assert.match(source, /Manage or create Agent/);
});

test('Expo broadcast clears prior game data and provides an in-app back route', () => {
  const source = readFileSync(
    new URL('../src/components/ExpoBroadcastBoard.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /setLiveState\(null\)/);
  assert.match(source, /setLiveEvents\(\[\]\)/);
  assert.match(source, /className="broadcast-back"/);
  assert.match(
    source,
    /href=\{demo \? '\/' : `\/game\/\$\{encodeURIComponent\(gameId\)\}`\}/,
  );
});

test('registration and portfolio setup render an explicit waiting room instead of a live round', () => {
  const source = readFileSync(
    new URL('../src/components/GameViewer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const registrationOpen = \['registration', 'portfolio_setup'\]\.includes/);
  assert.match(source, /const isRegistration = !demo && registrationOpen/);
  assert.match(source, /Waiting for the first seat\./);
  assert.match(source, /Your seat is not confirmed/);
  assert.match(source, /Return to Play and join/);
  assert.doesNotMatch(source, /gamePhase === 'registration'\) return 'omen'/);
  assert.match(source, /String\(events\.length\)\.padStart/);
  assert.doesNotMatch(
    source,
    /demo \? events\.length : latestEvent\?\.sequence/,
  );
  assert.match(source, /fillStatus === 'BLOCKED'/);
  assert.match(source, /Official Agent pool is unavailable/);
  assert.match(source, /gm-lobby-clock/);
  assert.match(source, /Official fill in/);
  assert.match(source, /Seats remaining/);
});

test('Live Game viewer shows only the authoritative decision deadline countdown', () => {
  const source = readFileSync(
    new URL('../src/components/GameViewer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /phase === 'decide'/);
  assert.match(source, /'phase_deadline_at'/);
  assert.match(source, /Decision window/);
  assert.match(source, /decisionRemaining <= 0/);
  assert.doesNotMatch(source, /Negotiation window/);
  assert.doesNotMatch(source, /Settlement countdown/);
});

test('live battle desk contains its terminal and exposes authoritative price motion', () => {
  const viewer = readFileSync(
    new URL('../src/components/GameViewer.tsx', import.meta.url),
    'utf8',
  );
  const market = readFileSync(
    new URL('../src/components/MarketIntelligence.tsx', import.meta.url),
    'utf8',
  );
  const styles = readFileSync(
    new URL('../src/app/arena402-game.css', import.meta.url),
    'utf8',
  );

  assert.match(viewer, /className="gm-battle-desk"/);
  assert.match(styles, /\.gm-desk-terminal \.gm-negotiation-terminal/);
  assert.match(styles, /max-width: 100%/);
  assert.match(styles, /\.gm-desk-inspector[\s\S]*isolation: isolate/);
  assert.match(market, /function PriceSignal/);
  assert.match(market, /good\.candles\.slice\(-6\)/);
  assert.match(market, /gm-price-commit-pulse/);
  assert.match(styles, /@keyframes gmPriceListen/);
  assert.match(styles, /\.gm-bulletin-compact \.gm-bulletin-copy h2[\s\S]*48px/);
});

test('Play loads entry resources independently and exposes retryable failures', () => {
  const source = readFileSync(
    new URL('../src/components/PlayJourney.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /Some entry checks need attention\./);
  assert.match(source, /Retry entry checks/);
  assert.match(source, /Retry the entry checks before waiting for matchmaking\./);
  assert.match(source, /Official pool unavailable/);
  assert.match(source, /Matchmaking receipt/);
  assert.match(source, /Your Agent is READY in the waiting game\./);
  assert.match(source, /Arena starts automatically at/);
  assert.match(source, /router\.replace/);
  assert.match(source, /game\.status === 'RUNNING'/);
  assert.doesNotMatch(source, /Twenty seats/);
});

test('Play renews expired entry authorization and replaces a mismatched mandate', () => {
  const source = readFileSync(
    new URL('../src/components/PlayJourney.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /join_authorization_expired/);
  assert.match(source, /window\.sessionStorage\.removeItem/);
  assert.match(source, /revokeCurrentGameMandate/);
  assert.match(source, /mandate\?\.joinAuthorizationId !== preflight\.joinAuthorizationId/);
});

test('Game entry replaces a mismatched active mandate before creating a new one', () => {
  const source = readFileSync(
    new URL('../src/components/GameEntryDesk.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /revokeCurrentGameMandate\(mandate\.mandateId\)/);
  assert.match(source, /requestStage = 'mandate_revoke'/);
  assert.match(source, /game_participant_limit_reached/);
  assert.match(source, /invalid_portfolio/);
});
