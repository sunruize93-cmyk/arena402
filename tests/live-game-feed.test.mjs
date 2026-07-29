import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const feed = loadTypeScriptModule(
  new URL('../src/lib/live-game-feed.ts', import.meta.url),
);

function event(sequence, type = 'arena.event') {
  return { sequence, type, data: {} };
}

test('timeline merge deduplicates by sequence and keeps deterministic order', () => {
  const replacement = event(2, 'replacement');
  assert.deepEqual(
    feed.mergeTimelineEvents(
      [event(1), event(2)],
      [event(3), replacement],
    ),
    [event(1), replacement, event(3)],
  );
});

test('timeline merge applies a bounded tail without quadratic scans', () => {
  assert.deepEqual(
    feed.mergeTimelineEvents(
      [event(1), event(2)],
      [event(3), event(4)],
      2,
    ).map((value) => value.sequence),
    [3, 4],
  );
});

test('timeline cursor advances from response and event sequences', () => {
  assert.equal(feed.timelineCursor(3, [event(5), event(8)], 7), 8);
  assert.equal(feed.timelineCursor(9, [], 4), 9);
});
