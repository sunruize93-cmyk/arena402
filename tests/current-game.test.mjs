import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const publicProjection = loadTypeScriptModule(
  new URL('../src/lib/public-projection.ts', import.meta.url),
);

function loadGameApi(handler = async () => ({})) {
  const calls = [];
  const gameApi = loadTypeScriptModule(
    new URL('../src/lib/game-api.ts', import.meta.url),
    {
      '@/lib/platform-api': {
        API_BASE_URL: 'https://api.arena402.test',
        ArenaApiError: class ArenaApiError extends Error {},
        arenaApiRequest: async (path, init, options) => {
          calls.push({ path, init, options });
          return handler(path, init, options);
        },
      },
      '@/lib/public-projection': publicProjection,
    },
  );
  return { calls, gameApi };
}

test('Current Game client uses only the public product routes', async () => {
  const expected = {
    game: { gameId: 'game-current', status: 'WAITING', participants: [] },
    nextGamePending: false,
    schemaVersion: 'arena.current-game.v1',
  };
  const { calls, gameApi } = loadGameApi(async () => expected);
  const controller = new AbortController();

  assert.deepEqual(await gameApi.getCurrentGame(controller.signal), expected);
  assert.equal(calls[0].path, '/api/v1/games/current');
  assert.equal(calls[0].init.signal, controller.signal);
  assert.equal(
    gameApi.getPawnhouseEventsUrl('game current', 4),
    'https://api.arena402.test/api/v1/pawnhouse/games/game%20current/events?after=4',
  );
});

test('join preflight carries one stable key and delegates CSRF to shared HTTP', async () => {
  const { calls, gameApi } = loadGameApi(async () => ({
    joinAuthorizationId: 'ja:test',
  }));

  await gameApi.getJoinPreflight('game/current', 'agent:one', 'join-key-1');

  assert.equal(calls[0].path, '/api/v1/games/game%2Fcurrent/join-preflight');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-key-1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { agentId: 'agent:one' });
  assert.deepEqual(calls[0].options, { csrf: true });
});

test('joining sends the locked portfolio through the formal contract', async () => {
  const { calls, gameApi } = loadGameApi(async () => ({
    participantId: 'participant:test',
  }));
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
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'join-final-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), payload);
  assert.deepEqual(calls[0].options, { csrf: true });
});

test('join readiness requires server authorization and no refusal', () => {
  const { gameApi } = loadGameApi();
  const ready = {
    eligible: true,
    readyToJoin: true,
    joinAuthorizationId: 'join-authorization',
    checks: {
      game: 'READY',
      agent: 'READY',
      runtime: 'READY',
      wallet: 'READY',
    },
    safeErrorCode: null,
    schemaVersion: 'arena.game-join-preflight.v1',
  };

  assert.equal(gameApi.isJoinPreflightReady(ready), true);
  assert.equal(gameApi.isJoinPreflightReady({ ...ready, eligible: false }), false);
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
      checks: { ...ready.checks, runtime: 'NOT_READY' },
    }),
    false,
  );
});

test('mandate and withdrawal mutations remain scoped and idempotent', async () => {
  const { calls, gameApi } = loadGameApi(async (path) =>
    path.includes('payment-mandates')
      ? { mandate: { mandateId: 'pm:test' } }
      : { status: 'WITHDRAWN' },
  );
  const mandate = {
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

  await gameApi.createPaymentMandate(mandate, 'mandate-key-1');
  await gameApi.withdrawCurrentGameParticipant(
    'game:test',
    'participant:test',
    'withdraw-key-1',
  );

  assert.deepEqual(JSON.parse(calls[0].init.body), mandate);
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'mandate-key-1');
  assert.deepEqual(calls[0].options, { csrf: true });
  assert.equal(
    calls[1].path,
    '/api/v1/games/game%3Atest/participants/participant%3Atest',
  );
  assert.equal(calls[1].init.method, 'DELETE');
  assert.equal(calls[1].init.headers['Idempotency-Key'], 'withdraw-key-1');
  assert.deepEqual(calls[1].options, { csrf: true });
});
