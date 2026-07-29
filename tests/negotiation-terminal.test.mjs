import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const publicProjection = loadTypeScriptModule(
  new URL('../src/lib/public-projection.ts', import.meta.url),
);

function loadNegotiationTerminal() {
  return loadTypeScriptModule(
    new URL('../src/lib/negotiation-terminal.ts', import.meta.url),
    { '@/lib/public-projection': publicProjection },
  );
}

const pairing = {
  sequence: 10,
  type: 'pairing.created',
  data: {
    pairingId: 'pair-10',
    buyerAgentId: 'cassius',
    sellerAgentId: 'livia',
    goodId: 'grain',
  },
  occurredAt: '2026-07-25T04:32:21Z',
};

const events = [
  pairing,
  {
    sequence: 11,
    type: 'negotiation.message',
    data: {
      pairingId: 'pair-10',
      actorAgentId: 'cassius',
      action: 'propose',
      priceAtomic: '2700000',
      quantity: 2,
      message: 'Two sacks before the northern gate closes.',
    },
    occurredAt: '2026-07-25T04:32:24Z',
  },
  {
    sequence: 12,
    type: 'negotiation.message',
    data: {
      pairingId: 'pair-10',
      actorAgentId: 'livia',
      action: 'accept',
      priceAtomic: '2700000',
      quantity: 2,
    },
    occurredAt: '2026-07-25T04:32:28Z',
  },
  {
    sequence: 13,
    type: 'settlement.chain_confirmed',
    data: {
      pairingId: 'pair-10',
      txHash: '0x402demo',
    },
    occurredAt: '2026-07-25T04:32:32Z',
  },
];

test('Arena timeline events become a two-party terminal transcript', () => {
  const { buildNegotiationTerminalLines } = loadNegotiationTerminal();

  const lines = buildNegotiationTerminalLines(events, 'pair-10');
  const transcript = lines.map((line) => line.text).join('\n');

  assert.match(transcript, /BUYER connected — cassius/);
  assert.match(transcript, /SELLER connected — livia/);
  assert.match(transcript, /BUYER > PROPOSE 2.7 GOLD · QTY 2/);
  assert.match(transcript, /Two sacks before the northern gate closes/);
  assert.match(transcript, /SELLER > ACCEPT 2.7 GOLD/);
  assert.match(transcript, /TRADE CONFIRMED/);
  assert.match(transcript, /TX: 0x402demo/);
  assert.equal(lines.at(-1).kind, 'ok');
});

test('the terminal ignores messages and settlement events from other pairings', () => {
  const { buildNegotiationTerminalLines } = loadNegotiationTerminal();
  const noisyEvents = [
    ...events,
    {
      sequence: 14,
      type: 'negotiation.message',
      data: {
        pairingId: 'pair-other',
        actorAgentId: 'intruder',
        action: 'reject',
      },
    },
  ];

  const transcript = buildNegotiationTerminalLines(noisyEvents, 'pair-10')
    .map((line) => line.text)
    .join('\n');

  assert.doesNotMatch(transcript, /INTRUDER|CHANNEL CLOSED/);
});

test('the terminal accepts the production public participant and negotiation fields', () => {
  const { buildNegotiationTerminalLines } = loadNegotiationTerminal();
  const productionEvents = [
    {
      sequence: 20,
      type: 'pairing.created',
      data: {
        pairingId: 'pair-live',
        buyerParticipantId: 'participant-cassius',
        sellerParticipantId: 'participant-livia',
        good: 'iron',
      },
    },
    {
      sequence: 21,
      type: 'negotiation.message',
      data: {
        negotiationId: 'neg:pair-live',
        role: 'seller',
        action: 'propose',
        priceAtomic: '6100000',
        message: 'The Crown is already paying above six.',
      },
    },
  ];

  const transcript = buildNegotiationTerminalLines(
    productionEvents,
    'pair-live',
  )
    .map((line) => line.text)
    .join('\n');

  assert.match(transcript, /BUYER connected — participant-cassius/);
  assert.match(transcript, /SELLER connected — participant-livia/);
  assert.match(transcript, /SELLER > PROPOSE 6.1 GOLD/);
  assert.match(transcript, /Crown is already paying/);
});
