import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const projection = loadTypeScriptModule(
  new URL('../src/lib/market-projection.ts', import.meta.url),
);

const events = [
  {
    sequence: 1,
    type: 'round.started',
    roundId: 'round-1',
    data: { round: 1 },
  },
  {
    sequence: 2,
    type: 'market.intent_published',
    roundId: 'round-1',
    data: {
      good: 'grain',
      side: 'buy',
      quantity: 1,
      participantId: 'participant-buyer',
      publicPriceAtomic: 2_000_000,
    },
  },
  {
    sequence: 3,
    type: 'market.engagement_created',
    roundId: 'round-1',
    data: {
      good: 'grain',
      engagementId: 'engagement:request:task-a2a:1',
      buyerParticipantId: 'participant-buyer',
      sellerParticipantId: 'participant-seller',
    },
  },
];

test('the market projection recognizes explicit and event-derived A2A games', () => {
  assert.equal(
    projection.resolveMarketProtocol(
      { marketProtocol: 'agent_a2a.v1' },
      [],
    ),
    'agent_a2a.v1',
  );
  assert.equal(
    projection.resolveMarketProtocol({}, events),
    'agent_a2a.v1',
  );
  assert.equal(
    projection.resolveMarketProtocol({}, []),
    'fcfs.v1',
  );
});

test('the current A2A round projects public intents and engaged participants', () => {
  const view = projection.projectCurrentRoundMarket(
    { currentRound: 1 },
    events,
  );

  assert.equal(view.protocol, 'agent_a2a.v1');
  assert.deepEqual(view.orders, [
    {
      sequence: 2,
      participantId: 'participant-buyer',
      side: 'buy',
      goodId: 'grain',
      quantity: 1,
      publicPriceAtomic: 2_000_000,
    },
  ]);
  assert.deepEqual(
    [...view.engagedParticipantIds].sort(),
    ['participant-buyer', 'participant-seller'],
  );
});
