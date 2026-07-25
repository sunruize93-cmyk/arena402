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

const ledger = loadTypeScriptModule(
  new URL('../src/lib/ledger-model.ts', import.meta.url),
);

const REAL_TX =
  '0x8f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6c41e';

function settlementEvents() {
  return [
    { sequence: 1, type: 'round.started', data: { roundIndex: 2 } },
    {
      sequence: 2,
      type: 'pairing.created',
      data: {
        pairingId: 'pair-02-a',
        buyerAgentId: 'cassius',
        sellerAgentId: 'livia',
        goodId: 'grain',
      },
    },
    {
      sequence: 3,
      type: 'negotiation.message',
      data: {
        pairingId: 'pair-02-a',
        action: 'accept',
        priceAtomic: '2900000',
        quantity: 2,
      },
    },
    {
      sequence: 4,
      type: 'settlement.intent_frozen',
      data: { pairingId: 'pair-02-a', amountAtomic: '5800000' },
    },
    { sequence: 5, type: 'settlement.approved', data: { pairingId: 'pair-02-a' } },
    {
      sequence: 6,
      type: 'settlement.submitted',
      data: { pairingId: 'pair-02-a', txHash: REAL_TX },
    },
    {
      sequence: 7,
      type: 'settlement.chain_confirmed',
      data: { pairingId: 'pair-02-a', txHash: REAL_TX },
      occurredAt: '2026-07-25T04:12:09.000Z',
    },
    {
      sequence: 8,
      type: 'settlement.inventory_committed',
      data: { pairingId: 'pair-02-a' },
    },
  ];
}

test('a full settlement lifecycle becomes one committed ledger row', () => {
  const trades = ledger.buildLedgerTrades(settlementEvents());
  assert.equal(trades.length, 1);
  const trade = trades[0];
  assert.equal(trade.pairingId, 'pair-02-a');
  assert.equal(trade.round, 2);
  assert.equal(trade.goodId, 'grain');
  assert.equal(trade.buyer, 'Cassius');
  assert.equal(trade.seller, 'Livia');
  assert.equal(trade.quantity, 2);
  assert.equal(trade.priceAtomic, 2_900_000);
  assert.equal(trade.amountAtomic, 5_800_000);
  assert.equal(trade.txHash, REAL_TX);
  assert.equal(trade.status, 'committed');
  assert.equal(trade.stageReached, 4);
  assert.equal(trade.verifiable, true);
  assert.equal(trade.confirmedAt, '2026-07-25T04:12:09.000Z');
});

test('pairings without settlement events never enter the ledger', () => {
  const trades = ledger.buildLedgerTrades([
    { sequence: 1, type: 'round.started', data: { roundIndex: 1 } },
    {
      sequence: 2,
      type: 'pairing.created',
      data: {
        pairingId: 'pair-01-a',
        buyerAgentId: 'marius',
        sellerAgentId: 'octavia',
        goodId: 'iron',
      },
    },
    {
      sequence: 3,
      type: 'negotiation.message',
      data: { pairingId: 'pair-01-a', action: 'reject' },
    },
  ]);
  assert.equal(trades.length, 0);
});

test('reverted settlements are kept but marked failed', () => {
  const events = settlementEvents().slice(0, 6);
  events.push({
    sequence: 7,
    type: 'settlement.reverted',
    data: { pairingId: 'pair-02-a' },
  });
  const trades = ledger.buildLedgerTrades(events);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].status, 'failed');
});

test('truncated demo hashes are never verifiable and get no explorer URL', () => {
  assert.equal(ledger.isVerifiableTxHash('0x4021c7a9d…f1e8'), false);
  assert.equal(ledger.explorerTxUrl('0x4021c7a9d…f1e8'), null);
  assert.equal(ledger.isVerifiableTxHash(REAL_TX), true);
  assert.match(ledger.explorerTxUrl(REAL_TX), /\/tx\/0x8f2a/);
});

test('snake_case production field names are accepted', () => {
  const trades = ledger.buildLedgerTrades([
    { sequence: 1, type: 'round.started', data: { round_index: 3 } },
    {
      sequence: 2,
      type: 'pairing.created',
      data: {
        pairing_id: 'pair-03-b',
        buyer_participant_id: 'agent:aurex',
        seller_participant_id: 'agent:nyra',
        good_id: 'gems',
      },
    },
    {
      sequence: 3,
      type: 'settlement.chain_confirmed',
      data: { pairing_id: 'pair-03-b', tx_hash: REAL_TX },
    },
  ]);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].round, 3);
  assert.equal(trades[0].goodId, 'gems');
  assert.equal(trades[0].buyer, 'Aurex');
  assert.equal(trades[0].seller, 'Nyra');
  assert.equal(trades[0].status, 'confirmed');
  assert.equal(trades[0].verifiable, true);
});

test('stats aggregate sealed volume and skip failed trades', () => {
  const sealed = settlementEvents();
  const failed = [
    { sequence: 20, type: 'round.started', data: { roundIndex: 3 } },
    {
      sequence: 21,
      type: 'pairing.created',
      data: {
        pairingId: 'pair-03-a',
        buyerAgentId: 'marius',
        sellerAgentId: 'octavia',
        goodId: 'warhorse',
      },
    },
    {
      sequence: 22,
      type: 'settlement.intent_frozen',
      data: { pairingId: 'pair-03-a', amountAtomic: '7400000' },
    },
    {
      sequence: 23,
      type: 'settlement.confirmation_timeout',
      data: { pairingId: 'pair-03-a' },
    },
  ];
  const trades = ledger.buildLedgerTrades([...sealed, ...failed]);
  const stats = ledger.buildLedgerStats(trades);
  assert.equal(stats.sealedCount, 1);
  assert.equal(stats.settledAtomic, 5_800_000);
  assert.equal(stats.failedCount, 1);
  assert.equal(stats.lastConfirmedAt, '2026-07-25T04:12:09.000Z');
});

test('gold formatting trims atomic values for display', () => {
  assert.equal(ledger.formatGold(2_900_000), '2.9');
  assert.equal(ledger.formatGold(5_000_000), '5');
  assert.equal(ledger.formatGold(5_850_000), '5.85');
  assert.equal(ledger.formatGold(null), '—');
});
