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

test('the demo advances through five rounds and loops back to round one', () => {
  const {
    DEMO_INITIAL_EVENT_COUNT,
    DEMO_ROUNDS,
    advanceDemoPlayback,
  } = loadTypeScriptModule(new URL('../src/lib/game-demo.ts', import.meta.url));

  assert.equal(DEMO_ROUNDS.length, 5);
  assert.deepEqual(
    DEMO_ROUNDS.map((round) => round.number),
    [1, 2, 3, 4, 5],
  );

  const secondRound = advanceDemoPlayback({
    roundIndex: 0,
    eventCount: DEMO_ROUNDS[0].events.findIndex(
      (event) => event.type === 'round.closed',
    ),
  });
  assert.deepEqual(secondRound, {
    roundIndex: 1,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  });

  const firstRoundAgain = advanceDemoPlayback({
    roundIndex: 4,
    eventCount: DEMO_ROUNDS[4].events.findIndex(
      (event) => event.type === 'round.closed',
    ),
  });
  assert.deepEqual(firstRoundAgain, {
    roundIndex: 0,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  });
});

test('the demo game projection follows the visible event phase', () => {
  const { buildDemoGameState, DEMO_INITIAL_EVENT_COUNT, DEMO_ROUNDS } =
    loadTypeScriptModule(new URL('../src/lib/game-demo.ts', import.meta.url));
  const round = DEMO_ROUNDS[1];

  const bargaining = buildDemoGameState(
    round,
    round.events.slice(0, DEMO_INITIAL_EVENT_COUNT),
  );
  assert.equal(bargaining.currentRound, 2);
  assert.equal(bargaining.rounds[1].phase, 'negotiating');

  const settlingEventIndex = round.events.findIndex(
    (event) => event.type === 'settlement.intent_frozen',
  );
  const settling = buildDemoGameState(
    round,
    round.events.slice(0, settlingEventIndex + 1),
  );
  assert.equal(settling.rounds[1].phase, 'settling');

  const closed = buildDemoGameState(round, round.events);
  assert.equal(closed.rounds[1].phase, 'closed');
});

test('the complete demo state carries every round price snapshot for replay', () => {
  const { buildDemoGameState, DEMO_ROUNDS } = loadTypeScriptModule(
    new URL('../src/lib/game-demo.ts', import.meta.url),
  );
  const finalRound = DEMO_ROUNDS.at(-1);
  const allEvents = DEMO_ROUNDS.flatMap((round) => round.events);
  const state = buildDemoGameState(finalRound, allEvents);

  assert.equal(state.priceSnapshots.length, 20);
  assert.equal(
    new Set(state.priceSnapshots.map((snapshot) => snapshot.roundIndex)).size,
    5,
  );
});
