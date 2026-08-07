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

const replayPosition = loadTypeScriptModule(
  new URL('../src/lib/replay-position.ts', import.meta.url),
);

test('replay starts from the first round event instead of lobby history', () => {
  const events = [
    { type: 'game.created', roundId: null, data: {} },
    { type: 'participant.joined', roundId: null, data: {} },
    {
      type: 'world.event_revealed',
      roundId: 'round:game-1:1',
      data: { round: 1 },
    },
  ];

  assert.equal(replayPosition.initialReplayEventCount(events), 3);
});

test('round navigation survives a missing round.started event', () => {
  const events = [
    { type: 'game.created', roundId: null, data: {} },
    {
      type: 'world.event_revealed',
      roundId: 'round:game-1:1',
      data: { round: 1 },
    },
    {
      type: 'round.closed',
      roundId: 'round:game-1:1',
      data: { roundIndex: 1 },
    },
    {
      type: 'round.started',
      roundId: 'round:game-1:2',
      data: { roundIndex: 2 },
    },
  ];

  assert.deepEqual(replayPosition.buildReplayRoundStarts(events), [
    { round: 1, eventCount: 2 },
    { round: 2, eventCount: 4 },
  ]);
  assert.equal(replayPosition.timelineEventRound(events[1]), 1);
});
