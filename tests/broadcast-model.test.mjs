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

test('broadcast goods use authoritative round candles when the API supplies them', () => {
  const { buildBroadcastGoods } = loadTypeScriptModule(
    new URL('../src/lib/broadcast-model.ts', import.meta.url),
  );
  const state = {
    currentRound: 2,
    priceSnapshots: [
      {
        round: 1,
        goodId: 'grain',
        openAtomic: '2000000',
        highAtomic: '2300000',
        lowAtomic: '1900000',
        closeAtomic: '2200000',
        committedTradeCount: 4,
      },
      {
        round: 2,
        goodId: 'grain',
        openAtomic: '2200000',
        highAtomic: '2800000',
        lowAtomic: '2150000',
        closeAtomic: '2700000',
        committedTradeCount: 6,
      },
    ],
  };

  const grain = buildBroadcastGoods(state, []).find(
    (good) => good.goodId === 'grain',
  );
  assert.equal(grain.currentAtomic, 2_700_000);
  assert.equal(grain.previousAtomic, 2_200_000);
  assert.equal(grain.candles.length, 2);
  assert.equal(grain.candles[1].high, 2_800_000);
  assert.equal(grain.dataQuality, 'authoritative');
  assert.equal(
    buildBroadcastGoods(state, []).find((good) => good.goodId === 'iron')
      .dataQuality,
    'awaiting_authority',
  );
});

test('broadcast goods wait instead of rebuilding prices from public events', () => {
  const { buildBroadcastGoods } = loadTypeScriptModule(
    new URL('../src/lib/broadcast-model.ts', import.meta.url),
  );
  const events = [
    {
      sequence: 4,
      type: 'world.event_revealed',
      data: {
        round: 1,
        effects: [
          {
            kind: 'price_multiply_bps',
            good: 'grain',
            target: 'market',
            basisPoints: 15000,
          },
        ],
      },
    },
  ];

  const grain = buildBroadcastGoods({ currentRound: 1 }, events).find(
    (good) => good.goodId === 'grain',
  );
  assert.equal(grain.currentAtomic, null);
  assert.equal(grain.candles.length, 0);
  assert.equal(grain.dataQuality, 'awaiting_authority');
});

test('leaderboard prefers the live ranking projection and never treats seats as ELO', () => {
  const { buildBroadcastRankings } = loadTypeScriptModule(
    new URL('../src/lib/broadcast-model.ts', import.meta.url),
  );
  const live = buildBroadcastRankings({
    liveRankings: [
      { rank: 2, agentId: 'cassius', netWorthAtomic: '24900000' },
      { rank: 1, agentId: 'livia', netWorthAtomic: '27600000' },
    ],
    participants: [{ agent_id: 'seat-order-is-not-a-ranking' }],
  });
  assert.deepEqual(
    live.rows.map((row) => row.name),
    ['Livia', 'Cassius'],
  );
  assert.equal(live.kind, 'live_net_worth');

  const waiting = buildBroadcastRankings({
    participants: [{ agent_id: 'cassius' }, { agent_id: 'livia' }],
  });
  assert.equal(waiting.kind, 'awaiting_authority');
  assert.equal(waiting.rows.every((row) => row.value === null), true);
});

test('a completed game uses its authoritative final settlement prices', () => {
  const { buildBroadcastGoods } = loadTypeScriptModule(
    new URL('../src/lib/broadcast-model.ts', import.meta.url),
  );
  const grain = buildBroadcastGoods(
    {
      phase: 'completed',
      currentRound: 5,
      finalPrices: { grain: '3300000' },
    },
    [],
  ).find((good) => good.goodId === 'grain');

  assert.equal(grain.currentAtomic, 3_300_000);
});
