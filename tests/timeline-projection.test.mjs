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
  Function('module', 'exports', compiled)(module, module.exports);
  return module.exports;
}

const projection = loadTypeScriptModule(
  new URL('../src/lib/timeline-projection.ts', import.meta.url),
);

const event = (sequence, type, data = {}) => ({
  sequence,
  type,
  data,
  occurredAt: null,
});

test('active pairings exclude every pairing already closed in the visible timeline', () => {
  const events = [
    event(1, 'pairing.created', { pairingId: 'older-active' }),
    event(2, 'pairing.created', { pairingId: 'newer-closed' }),
    event(3, 'pairing.closed', { pairingId: 'newer-closed' }),
  ];

  assert.deepEqual(
    projection.activePairingIds(events),
    ['older-active'],
  );
});

test('production terminal events close pairings without a synthetic pairing.closed event', () => {
  const rejected = [
    event(1, 'pairing.created', { pairingId: 'pair-rejected' }),
    event(2, 'negotiation.message', {
      negotiationId: 'neg:pair-rejected',
      action: 'reject',
    }),
  ];
  const settled = [
    event(3, 'pairing.created', { pairingId: 'pair-settled' }),
    event(4, 'settlement.inventory_committed', {
      pairingId: 'pair-settled',
    }),
  ];

  assert.deepEqual(projection.activePairingIds(rejected), []);
  assert.deepEqual(projection.activePairingIds(settled), []);
});

test('a round close clears a pairing even when its terminal event was missed', () => {
  const events = [
    { ...event(1, 'pairing.created', { pairingId: 'pair-stale' }), roundId: 'round-1' },
    { ...event(2, 'round.closed', {}), roundId: 'round-1' },
  ];

  assert.deepEqual(projection.activePairingIds(events), []);
});

test('thinking stops on negotiation, settlement, round, or snapshot terminal state', () => {
  const proposed = [
    event(1, 'pairing.created', { pairingId: 'pair-1' }),
    event(2, 'negotiation.message', {
      negotiationId: 'neg:pair-1',
      action: 'propose',
    }),
  ];

  assert.equal(
    projection.isPairingAwaitingAgentAction(proposed, 'pair-1'),
    true,
  );
  assert.equal(
    projection.isPairingAwaitingAgentAction(
      [
        ...proposed,
        event(3, 'negotiation.message', {
          negotiationId: 'neg:pair-1',
          action: 'accept',
        }),
      ],
      'pair-1',
    ),
    false,
  );
  assert.equal(
    projection.isPairingAwaitingAgentAction(proposed, 'pair-1', 'settling'),
    false,
  );
  assert.equal(
    projection.isPairingAwaitingAgentAction(
      [
        ...proposed,
        event(3, 'settlement.intent_frozen', { pairingId: 'pair-1' }),
      ],
      'pair-1',
    ),
    false,
  );
});

test('replay price snapshots are visible only after that round closes', () => {
  const snapshots = [
    { round: 1, close: '5' },
    { round: 2, close: '6' },
  ];

  assert.deepEqual(
    projection.visibleReplaySnapshots(snapshots, [
      event(1, 'round.started', { round: 1 }),
      event(2, 'decision.applied', { round: 1 }),
    ]),
    [],
  );
  assert.deepEqual(
    projection.visibleReplaySnapshots(snapshots, [
      event(1, 'round.started', { round: 1 }),
      event(2, 'round.closed', { round: 1 }),
      event(3, 'round.started', { round: 2 }),
    ]),
    [{ round: 1, close: '5' }],
  );
});
