import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const PREFLIGHT = {
  gameId: 'game:test',
  agentId: 'agent:test',
  eligible: true,
  readyToJoin: true,
  joinAuthorizationId: 'ja:new',
  checks: {},
  mandateRequirements: {
    chainId: 1439,
    tokenAddress: `0x${'1'.repeat(40)}`,
    maxPerPaymentAtomic: '100',
    maxCumulativeAtomic: '500',
    allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT',
    expiresAt: '2030-01-01T00:00:00.000Z',
  },
  safeErrorCode: null,
  schemaVersion: 'arena.game-join-preflight.v2',
};

function loadEntry(overrides = {}) {
  const calls = [];
  const gameApi = {
    createPaymentMandate: async (payload, key) => {
      calls.push(['create', payload, key]);
      return { mandate: { ...payload, revokedAt: null } };
    },
    getArenaWallet: async () => {
      calls.push(['wallet']);
      return { wallet: {} };
    },
    getJoinPreflight: async (...args) => {
      calls.push(['preflight', ...args]);
      return PREFLIGHT;
    },
    getPaymentMandate: async () => ({ mandate: null }),
    isJoinPreflightReady: (value) =>
      value.eligible === true
      && value.readyToJoin === true
      && value.safeErrorCode === null,
    joinCurrentGame: async (...args) => {
      calls.push(['join', ...args]);
      return { participantId: 'participant:test' };
    },
    revokeCurrentGameMandate: async (id) => {
      calls.push(['revoke', id]);
      return {};
    },
    ...overrides,
  };
  class ArenaApiError extends Error {
    constructor(status, code) {
      super(code);
      this.status = status;
      this.code = code;
    }
  }
  const entry = loadTypeScriptModule(
    new URL('../src/lib/current-game-entry.ts', import.meta.url),
    {
      '@/lib/game-api': gameApi,
      '@/lib/platform-api': { ArenaApiError },
    },
  );
  return { calls, entry };
}

test('mandates are reusable only for the same live authorization', () => {
  const { entry } = loadEntry();
  const mandate = {
    mandateId: 'pm:test',
    joinAuthorizationId: 'ja:new',
    expiresAt: '2030-01-01T00:00:00.000Z',
    revokedAt: null,
  };

  assert.equal(entry.isReusablePaymentMandate(mandate, PREFLIGHT, 0), true);
  assert.equal(
    entry.isReusablePaymentMandate({ ...mandate, revokedAt: '2029-01-01' }, PREFLIGHT, 0),
    false,
  );
  assert.equal(
    entry.isReusablePaymentMandate({ ...mandate, expiresAt: '2020-01-01' }, PREFLIGHT),
    false,
  );
  assert.equal(
    entry.isReusablePaymentMandate({ ...mandate, joinAuthorizationId: 'ja:old' }, PREFLIGHT, 0),
    false,
  );
});

test('entry preparation performs the optional wallet gate before preflight', async () => {
  const { calls, entry } = loadEntry();
  await entry.prepareCurrentGameEntry({
    gameId: 'game:test',
    agentId: 'agent:test',
    preflightKey: 'preflight-key',
    checkWallet: true,
  });
  assert.deepEqual(calls, [
    ['wallet'],
    ['preflight', 'game:test', 'agent:test', 'preflight-key'],
  ]);
});

test('sealing revokes a stale mandate then creates and joins once', async () => {
  const { calls, entry } = loadEntry({
    getPaymentMandate: async () => ({
      mandate: {
        mandateId: 'pm:old',
        joinAuthorizationId: 'ja:old',
        expiresAt: '2030-01-01T00:00:00.000Z',
        revokedAt: null,
      },
    }),
  });
  const result = await entry.sealCurrentGameEntry({
    gameId: 'game:test',
    agentId: 'agent:test',
    preflight: PREFLIGHT,
    keys: {
      mandateId: 'pm:new',
      mandateRequest: 'mandate-key',
      mandateValidFrom: '2029-01-01T00:00:00.000Z',
      join: 'join-key',
    },
    portfolio: { cashAtomic: '20000000', holdings: {} },
  });

  assert.equal(result.participantId, 'participant:test');
  assert.deepEqual(calls.map((call) => call[0]), ['revoke', 'create', 'join']);
  assert.equal(calls[0][1], 'pm:old');
  assert.equal(calls[1][1].joinAuthorizationId, 'ja:new');
  assert.equal(calls[2][3], 'join-key');
  assert.deepEqual(calls[2][2].portfolio, {
    cashAtomic: '20000000',
    holdings: {},
  });
});

test('sealing reuses a valid mandate without mutating it', async () => {
  const current = {
    mandateId: 'pm:current',
    joinAuthorizationId: 'ja:new',
    expiresAt: '2030-01-01T00:00:00.000Z',
    revokedAt: null,
  };
  const { calls, entry } = loadEntry({
    getPaymentMandate: async () => ({ mandate: current }),
  });

  await entry.sealCurrentGameEntry({
    gameId: 'game:test',
    agentId: 'agent:test',
    preflight: PREFLIGHT,
    keys: {
      mandateId: 'pm:new',
      mandateRequest: 'mandate-key',
      mandateValidFrom: '2029-01-01T00:00:00.000Z',
      join: 'join-key',
    },
  });

  assert.deepEqual(calls.map((call) => call[0]), ['join']);
  assert.equal(calls[0][2].paymentMandateId, 'pm:current');
});
