import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const publicProjection = loadTypeScriptModule(
  new URL('../src/lib/public-projection.ts', import.meta.url),
);

function loadBroadcastModel() {
  return loadTypeScriptModule(
    new URL('../src/lib/broadcast-model.ts', import.meta.url),
    { '@/lib/public-projection': publicProjection },
  );
}

test('broadcast goods use authoritative round candles when the API supplies them', () => {
  const { buildBroadcastGoods } = loadBroadcastModel();
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
        lastClearingAtomic: '2750000',
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
  assert.equal(grain.lastClearingAtomic, 2_750_000);
  assert.equal(grain.latestVolume, 6);
  assert.equal(grain.dataQuality, 'authoritative_ohlc');
  assert.equal(
    buildBroadcastGoods(state, []).find((good) => good.goodId === 'iron')
      .dataQuality,
    'awaiting_authority',
  );
});

test('broadcast goods wait instead of rebuilding prices from public events', () => {
  const { buildBroadcastGoods } = loadBroadcastModel();
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
  const { buildBroadcastRankings } = loadBroadcastModel();
  const live = buildBroadcastRankings({
    liveRankings: [
      { rank: 2, agentId: 'cassius', netWorthAtomic: '24900000' },
      { rank: 1, agentId: 'livia', netWorthAtomic: '27600000' },
    ],
    participants: [{ agent_id: 'seat-order-is-not-a-ranking' }],
  });
  assert.deepEqual(
    live.rows.map((row) => row.name),
    ['livia', 'cassius'],
  );
  assert.equal(live.kind, 'live_net_worth');

  const waiting = buildBroadcastRankings({
    participants: [{ agent_id: 'cassius' }, { agent_id: 'livia' }],
  });
  assert.equal(waiting.kind, 'awaiting_authority');
  assert.equal(waiting.rows.every((row) => row.value === null), true);
});

test('event reference snapshots remain distinct from committed OHLC', () => {
  const { buildBroadcastGoods } = loadBroadcastModel();
  const grain = buildBroadcastGoods(
    {
      priceSnapshots: [
        {
          roundIndex: 1,
          goodId: 'grain',
          marketPriceAtomic: '3200000',
          previousMarketPriceAtomic: '2000000',
          priceKind: 'event_reference',
          committedTradeCount: 1,
          lastClearingAtomic: '3050000',
        },
      ],
    },
    [],
  ).find((good) => good.goodId === 'grain');

  assert.equal(grain.dataQuality, 'event_reference');
  assert.equal(grain.currentAtomic, 3_200_000);
  assert.equal(grain.previousAtomic, 2_000_000);
  assert.equal(grain.changePercent, 60);
  assert.equal(grain.lastClearingAtomic, 3_050_000);
});

test('completed games prefer frozen rankings over the last live estimate', () => {
  const { buildBroadcastRankings } = loadBroadcastModel();
  const ranking = buildBroadcastRankings({
    phase: 'completed',
    liveRankings: [
      { rank: 1, agentId: 'live-leader', netWorthAtomic: '25000000' },
    ],
    rankings: [
      { rank: 1, agentId: 'final-winner', netWorthAtomic: '30000000' },
    ],
  });

  assert.equal(ranking.kind, 'final_net_worth');
  assert.equal(ranking.rows[0].name, 'final-winner');
});

test('a completed game uses its authoritative final settlement prices', () => {
  const { buildBroadcastGoods } = loadBroadcastModel();
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
