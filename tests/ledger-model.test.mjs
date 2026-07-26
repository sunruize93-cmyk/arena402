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

const TEMPLATE = 'https://testnet.blockscout.injective.network/tx/{txHash}';
const BUYER_ADDR = '0x1111111111111111111111111111111111111111';
const SELLER_ADDR = '0x2222222222222222222222222222222222222222';
const FACILITATOR_ADDR = '0x3333333333333333333333333333333333333333';

function apiTrade(overrides = {}) {
  return {
    tradeId: 'settle-01',
    gameId: 'game-77',
    round: 4,
    goodId: 'warhorse',
    quantity: 2,
    priceAtomic: '3100000',
    amountAtomic: '6200000',
    buyer: {
      agentId: 'agent:cassius',
      displayName: 'Cassius',
      accountAddress: BUYER_ADDR,
    },
    seller: {
      agentId: 'agent:livia',
      displayName: 'Livia',
      accountAddress: SELLER_ADDR,
    },
    pairingId: 'pair-04-a',
    chainId: 1439,
    txHash: REAL_TX,
    blockNumber: '1204882',
    chainConfirmedAt: '2026-07-25T04:12:09+00:00',
    facilitatorAddress: FACILITATOR_ADDR,
    status: 'inventory_committed',
    createdAt: '2026-07-25T04:11:52+00:00',
    schemaVersion: 'arena402.trade-ledger-entry.v1',
    ...overrides,
  };
}

test('a committed ledger-API row maps onto the display shape', () => {
  const trade = ledger.mapLedgerApiTrade(apiTrade());
  assert.equal(trade.tradeId, 'settle-01');
  assert.equal(trade.gameId, 'game-77');
  assert.equal(trade.round, 4);
  assert.equal(trade.goodId, 'warhorse');
  assert.equal(trade.quantity, 2);
  assert.equal(trade.priceAtomic, 3_100_000);
  assert.equal(trade.amountAtomic, 6_200_000);
  assert.equal(trade.buyer, 'Cassius');
  assert.equal(trade.seller, 'Livia');
  assert.equal(trade.buyerAddress, BUYER_ADDR);
  assert.equal(trade.sellerAddress, SELLER_ADDR);
  assert.equal(trade.facilitatorAddress, FACILITATOR_ADDR);
  assert.equal(trade.blockNumber, '1204882');
  assert.equal(trade.status, 'committed');
  assert.equal(trade.stageReached, 4);
  assert.equal(trade.verifiable, true);
  assert.equal(trade.confirmedAt, '2026-07-25T04:12:09+00:00');
});

test('ledger-API statuses collapse onto the four display states', () => {
  const cases = [
    ['authorization_requested', 'pending', 0],
    ['submitted', 'pending', 2],
    ['chain_confirmed_uncommitted', 'confirmed', 3],
    ['inventory_committed', 'committed', 4],
    ['confirmation_timeout', 'failed', 2],
    ['reverted', 'failed', 2],
    ['submission_failed', 'failed', 1],
    ['some_future_status', 'pending', 0],
  ];
  for (const [raw, status, stage] of cases) {
    const trade = ledger.mapLedgerApiTrade(apiTrade({ status: raw }));
    assert.equal(trade.status, status, raw);
    assert.equal(trade.stageReached, stage, raw);
  }
});

test('historical rows tolerate null receipt fields', () => {
  const trade = ledger.mapLedgerApiTrade(
    apiTrade({
      txHash: null,
      blockNumber: null,
      chainConfirmedAt: null,
      facilitatorAddress: null,
      status: 'submitted',
    }),
  );
  assert.equal(trade.txHash, '');
  assert.equal(trade.blockNumber, null);
  assert.equal(trade.confirmedAt, null);
  assert.equal(trade.facilitatorAddress, null);
  assert.equal(trade.verifiable, false);
});

test('the backend explorer template wins and rejects bad hashes', () => {
  assert.equal(
    ledger.explorerTxUrlFromTemplate(TEMPLATE, REAL_TX),
    `https://testnet.blockscout.injective.network/tx/${REAL_TX}`,
  );
  assert.equal(ledger.explorerTxUrlFromTemplate(TEMPLATE, '0x402…e8'), null);
  // Without a template the build-time base still applies.
  assert.match(ledger.explorerTxUrlFromTemplate(null, REAL_TX), /\/tx\/0x8f2a/);
});

test('address URLs derive from the tx template base', () => {
  assert.equal(
    ledger.explorerAddressUrlFromTemplate(TEMPLATE, BUYER_ADDR),
    `https://testnet.blockscout.injective.network/address/${BUYER_ADDR}`,
  );
  assert.equal(ledger.explorerAddressUrlFromTemplate(TEMPLATE, 'not-an-address'), null);
  assert.match(
    ledger.explorerAddressUrlFromTemplate(null, SELLER_ADDR),
    /\/address\/0x2222/,
  );
});

test('head refresh keeps paginated tail rows and dedupes by tradeId', () => {
  const head = [
    ledger.mapLedgerApiTrade(apiTrade({ tradeId: 'settle-03' })),
    ledger.mapLedgerApiTrade(apiTrade({ tradeId: 'settle-02' })),
  ];
  const existing = [
    ledger.mapLedgerApiTrade(apiTrade({ tradeId: 'settle-02' })),
    ledger.mapLedgerApiTrade(apiTrade({ tradeId: 'settle-01' })),
  ];
  const merged = ledger.mergeLedgerHead(head, existing);
  assert.deepEqual(
    merged.map((trade) => trade.tradeId),
    ['settle-03', 'settle-02', 'settle-01'],
  );
});
