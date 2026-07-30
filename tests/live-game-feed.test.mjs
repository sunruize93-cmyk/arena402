import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

function loadFeed(gameApi = {}) {
  return loadTypeScriptModule(
    new URL('../src/lib/live-game-feed.ts', import.meta.url),
    {
      '@/lib/game-api': {
        decodePawnhouseTimelineEvent: (value) => value,
        getCurrentGame: async () => ({ game: null }),
        getPawnhouseEventsUrl: (gameId, after) =>
          `/events/${gameId}?after=${after}`,
        getPawnhouseGame: async () => {
          throw new Error('Unexpected state request');
        },
        getPawnhouseTimeline: async () => {
          throw new Error('Unexpected timeline request');
        },
        ...gameApi,
      },
    },
  );
}

const feed = loadFeed();

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

function controllerHarness({
  currentGame = null,
  state = { gameId: 'game-a', phase: 'waiting', schemaVersion: 'v1' },
  timeline = {
    gameId: 'game-a',
    events: [event(1)],
    nextAfter: 1,
    schemaVersion: 'v1',
  },
} = {}) {
  let activeState = state;
  let activeTimeline = timeline;
  let now = 1_000;
  let nextTimer = 1;
  let eventSource;
  const intervalCallbacks = new Map();
  const timeoutCallbacks = new Map();
  const timelineAfter = [];
  const snapshots = [];

  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.onopen = null;
      this.onerror = null;
      this.listeners = new Map();
      this.closed = false;
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    emit(type, data) {
      this.listeners.get(type)?.({ data: JSON.stringify(data) });
    }

    close() {
      this.closed = true;
    }
  }

  const module = loadFeed();
  const stop = module.startLiveGameFeed(
    {
      gameId: 'game-a',
      includeCurrentGame: true,
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    },
    {
      loadState: async () => activeState,
      loadTimeline: async (_gameId, after) => {
        timelineAfter.push(after);
        return activeTimeline;
      },
      loadCurrentGame: async () => currentGame,
      createEventSource: (url) => {
        eventSource = new FakeEventSource(url);
        return eventSource;
      },
      setInterval(callback) {
        const id = nextTimer++;
        intervalCallbacks.set(id, callback);
        return id;
      },
      clearInterval(id) {
        intervalCallbacks.delete(id);
      },
      setTimeout(callback) {
        const id = nextTimer++;
        timeoutCallbacks.set(id, callback);
        return id;
      },
      clearTimeout(id) {
        timeoutCallbacks.delete(id);
      },
      now: () => now++,
    },
  );

  return {
    intervalCallbacks,
    latest: () => snapshots.at(-1),
    snapshots,
    stop,
    timelineAfter,
    timeoutCallbacks,
    eventSource: () => eventSource,
    setState: (value) => {
      activeState = value;
    },
    setTimeline: (value) => {
      activeTimeline = value;
    },
  };
}

async function flushTasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test('live controller owns the initial snapshot and rejects another current game', async () => {
  const harness = controllerHarness({
    currentGame: { gameId: 'game-b' },
  });
  await flushTasks();

  assert.equal(harness.latest().gameId, 'game-a');
  assert.equal(harness.latest().state.gameId, 'game-a');
  assert.equal(harness.latest().currentGame, null);
  assert.deepEqual(harness.latest().events.map((value) => value.sequence), [1]);
  assert.equal(harness.latest().cursor, 1);
  assert.equal(harness.eventSource().url, '/events/game-a?after=1');
  harness.stop();
});

test('live controller merges SSE records and refreshes state after a bounded delay', async () => {
  const harness = controllerHarness();
  await flushTasks();
  harness.eventSource().onopen();
  harness.setState({
    gameId: 'game-a',
    phase: 'running',
    currentRound: 2,
    schemaVersion: 'v1',
  });
  harness.eventSource().emit('arena', event(2, 'round.started'));

  assert.deepEqual(harness.latest().events.map((value) => value.sequence), [1, 2]);
  assert.equal(harness.latest().source, 'sse');
  assert.equal(harness.timeoutCallbacks.size, 1);
  [...harness.timeoutCallbacks.values()][0]();
  await flushTasks();
  assert.equal(harness.latest().state.currentRound, 2);
  assert.equal(harness.latest().lastUpdatedAt > 0, true);
  harness.stop();
});

test('live controller falls back to cursor-aware polling and disposes every resource', async () => {
  const harness = controllerHarness();
  await flushTasks();
  harness.eventSource().onerror();
  assert.equal(harness.latest().source, 'poll');
  assert.equal(harness.latest().delayed, true);

  harness.setTimeline({
    gameId: 'game-a',
    events: [event(2)],
    nextAfter: 2,
    schemaVersion: 'v1',
  });
  [...harness.intervalCallbacks.values()][0]();
  await flushTasks();
  assert.deepEqual(harness.timelineAfter, [0, 1]);
  assert.deepEqual(harness.latest().events.map((value) => value.sequence), [1, 2]);
  assert.equal(harness.latest().delayed, false);

  harness.stop();
  assert.equal(harness.eventSource().closed, true);
  assert.equal(harness.intervalCallbacks.size, 0);
  assert.equal(harness.timeoutCallbacks.size, 0);
});
