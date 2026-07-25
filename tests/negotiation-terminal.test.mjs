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
  const { buildNegotiationTerminalLines } = loadTypeScriptModule(
    new URL('../src/lib/negotiation-terminal.ts', import.meta.url),
  );

  const lines = buildNegotiationTerminalLines(events, 'pair-10');
  const transcript = lines.map((line) => line.text).join('\n');

  assert.match(transcript, /BUYER connected — Cassius/);
  assert.match(transcript, /SELLER connected — Livia/);
  assert.match(transcript, /BUYER > PROPOSE 2.7 GOLD · QTY 2/);
  assert.match(transcript, /Two sacks before the northern gate closes/);
  assert.match(transcript, /SELLER > ACCEPT 2.7 GOLD/);
  assert.match(transcript, /TRADE CONFIRMED/);
  assert.match(transcript, /TX: 0x402demo/);
  assert.equal(lines.at(-1).kind, 'ok');
});

test('the terminal ignores messages and settlement events from other pairings', () => {
  const { buildNegotiationTerminalLines } = loadTypeScriptModule(
    new URL('../src/lib/negotiation-terminal.ts', import.meta.url),
  );
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
