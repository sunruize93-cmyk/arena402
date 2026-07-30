import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

class TestArenaApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const projection = loadTypeScriptModule(
  new URL('../src/lib/public-projection.ts', import.meta.url),
);
const gameApi = loadTypeScriptModule(
  new URL('../src/lib/game-api.ts', import.meta.url),
  {
    '@/lib/platform-api': {
      API_BASE_URL: 'https://api.example.test',
      ArenaApiError: TestArenaApiError,
      arenaApiRequest: async () => {
        throw new Error('Unexpected request');
      },
    },
    '@/lib/public-projection': projection,
  },
);

test('game projection decoder canonicalizes legacy aliases at the transport seam', () => {
  const decoded = gameApi.decodePawnhouseGameState({
    game_id: 'game-402',
    phase: 'running',
    schema_version: 'arena.pawnhouse.game.v1',
    current_round: 3,
    total_rounds: 5,
    price_history: [
      {
        round_index: 2,
        good_id: 'iron',
        close_atomic: '1300000',
      },
    ],
    live_rankings: [
      {
        agent_id: 'agent-a',
        net_worth_atomic: '21000000',
      },
    ],
  });

  assert.equal(decoded.gameId, 'game-402');
  assert.equal(decoded.currentRound, 3);
  assert.equal(decoded.totalRounds, 5);
  assert.equal(decoded.priceSnapshots[0].roundIndex, 2);
  assert.equal(decoded.priceSnapshots[0].goodId, 'iron');
  assert.equal(decoded.priceSnapshots[0].closeAtomic, '1300000');
  assert.equal(decoded.liveRankings[0].agentId, 'agent-a');
  assert.equal(decoded.liveRankings[0].netWorthAtomic, '21000000');
});

test('timeline decoder canonicalizes event data and rejects malformed authority records', () => {
  const decoded = gameApi.decodePawnhouseTimeline({
    game_id: 'game-402',
    schema_version: 'arena.pawnhouse.timeline.v1',
    next_after: 7,
    events: [
      {
        sequence: 7,
        type: 'settlement.inventory_committed',
        round_id: 'round-2',
        occurred_at: '2026-07-30T08:00:00Z',
        data: {
          agent_id: 'agent-a',
          transaction_hash: '0x402',
          price_atomic: '1200000',
        },
      },
    ],
  });

  assert.equal(decoded.nextAfter, 7);
  assert.equal(decoded.events[0].roundId, 'round-2');
  assert.equal(decoded.events[0].occurredAt, '2026-07-30T08:00:00Z');
  assert.equal(decoded.events[0].data.agentId, 'agent-a');
  assert.equal(decoded.events[0].data.transactionHash, '0x402');
  assert.throws(
    () =>
      gameApi.decodePawnhouseTimeline({
        game_id: 'game-402',
        schema_version: 'v1',
        events: [{ sequence: 'not-a-number', type: 'broken', data: {} }],
      }),
    (error) =>
      error instanceof TestArenaApiError &&
      error.status === 502 &&
      error.code === 'invalid_timeline_projection',
  );
});
