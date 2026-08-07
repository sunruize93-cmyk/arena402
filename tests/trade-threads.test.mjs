import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const timelineProjection = loadTypeScriptModule(
  new URL('../src/lib/timeline-projection.ts', import.meta.url),
);

const projection = loadTypeScriptModule(
  new URL('../src/lib/trade-threads.ts', import.meta.url),
  { '@/lib/timeline-projection': timelineProjection },
);

function event(sequence, type, data, roundId = 'round-3') {
  return { sequence, type, data, roundId };
}

test('projects a real A2A RFQ through negotiation and inventory commit', () => {
  const requestId = 'task_2e98';
  const events = [
    event(1, 'round.started', { round: 3 }),
    event(2, 'market.intent_published', {
      intentId: 'intent:buyer',
      participantId: 'gp-buyer',
      good: 'iron',
      side: 'buy',
    }),
    event(3, 'market.rfq_sent', {
      buyerIntentId: 'intent:buyer',
      requestIds: [requestId],
      attemptSequence: 1,
    }),
    event(4, 'market.engagement_created', {
      requestId,
      engagementId: `engagement:${requestId}`,
      buyerParticipantId: 'gp-buyer',
      sellerParticipantId: 'gp-seller',
      good: 'iron',
    }),
    event(5, 'market.negotiation_created', {
      requestId,
      negotiationId: `negotiation:${requestId}`,
    }),
    event(6, 'negotiation.message', {
      negotiationId: `negotiation:${requestId}`,
      role: 'buyer',
      action: 'propose',
      priceAtomic: '4000000',
      message: 'Four gold closes this round.',
    }),
    event(7, 'negotiation.message', {
      negotiationId: `negotiation:${requestId}`,
      role: 'seller',
      action: 'accept',
      priceAtomic: '4000000',
    }),
    event(8, 'market.deal_frozen', {
      negotiationId: `negotiation:${requestId}`,
      priceAtomic: '4000000',
    }),
    event(9, 'settlement.intent_frozen', {
      settlementIntentId: `settlement:negotiation:${requestId}`,
      amountAtomic: '4000000',
    }),
    event(10, 'settlement.submitted', {
      settlementIntentId: `settlement:negotiation:${requestId}`,
      txHash: '0x402',
    }),
    event(11, 'settlement.chain_confirmed', {
      settlementIntentId: `settlement:negotiation:${requestId}`,
      txHash: '0x402',
    }),
    event(12, 'settlement.inventory_committed', {
      settlementIntentId: `settlement:negotiation:${requestId}`,
    }),
  ];

  const [thread] = projection.buildTradeThreads(events);

  assert.equal(thread.id, `pairing:engagement:${requestId}`);
  assert.equal(thread.requestId, requestId);
  assert.equal(thread.roundIndex, 3);
  assert.equal(thread.buyerId, 'gp-buyer');
  assert.equal(thread.sellerId, 'gp-seller');
  assert.equal(thread.goodId, 'iron');
  assert.equal(thread.status, 'settled');
  assert.equal(thread.stageIndex, 4);
  assert.equal(thread.turnCount, 2);
  assert.equal(thread.agreedPriceAtomic, '4000000');
  assert.equal(thread.txHash, '0x402');
  assert.equal(thread.active, false);
});

test('keeps unselected RFQ requests visible without inventing a seller', () => {
  const events = [
    event(1, 'round.started', { roundIndex: 6 }, 'round-6'),
    event(2, 'market.intent_published', {
      intentId: 'intent:round-6:buyer',
      participantId: 'gp-buyer',
      good: 'grain',
      side: 'buy',
    }, 'round-6'),
    event(3, 'market.rfq_sent', {
      buyerIntentId: 'intent:round-6:buyer',
      requestIds: ['request-a', 'request-b'],
      attemptSequence: 2,
    }, 'round-6'),
    event(4, 'round.closed', { roundIndex: 6 }, 'round-6'),
  ];

  const threads = projection.buildTradeThreads(events);

  assert.equal(threads.length, 2);
  assert.deepEqual(
    threads.map((thread) => thread.requestId).sort(),
    ['request-a', 'request-b'],
  );
  for (const thread of threads) {
    assert.equal(thread.buyerId, 'gp-buyer');
    assert.equal(thread.sellerId, '');
    assert.equal(thread.status, 'expired');
    assert.equal(thread.stageIndex, 0);
    assert.equal(thread.rfqAttempt, 2);
    assert.equal(thread.active, false);
  }
});

test('projects legacy FCFS pairings as selectable negotiation threads', () => {
  const events = [
    event(1, 'round.started', { round: 1 }, 'round-1'),
    event(2, 'pairing.created', {
      pairingId: 'pair-legacy',
      buyerAgentId: 'cassius',
      sellerAgentId: 'livia',
      goodId: 'grain',
    }, 'round-1'),
    event(3, 'negotiation.message', {
      pairingId: 'pair-legacy',
      actorAgentId: 'cassius',
      action: 'propose',
      priceAtomic: '2500000',
    }, 'round-1'),
  ];

  const [thread] = projection.buildTradeThreads(events);

  assert.equal(thread.id, 'pair-legacy');
  assert.equal(thread.status, 'negotiating');
  assert.equal(thread.stageIndex, 2);
  assert.equal(thread.active, true);
});

test('current-round live threads take focus before historical settled threads', () => {
  const threads = [
    {
      id: 'historical',
      pairingId: 'pair-historical',
      roundIndex: 2,
      active: false,
    },
    {
      id: 'current-rfq',
      pairingId: '',
      roundIndex: 3,
      active: true,
    },
    {
      id: 'current-negotiation',
      pairingId: 'pair-current',
      roundIndex: 3,
      active: true,
    },
  ];

  assert.equal(
    projection.preferredTradeThread(threads, 3).id,
    'current-negotiation',
  );
});
