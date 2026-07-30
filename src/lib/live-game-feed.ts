import {
  decodePawnhouseTimelineEvent,
  getCurrentGame,
  getPawnhouseEventsUrl,
  getPawnhouseGame,
  getPawnhouseTimeline,
} from '@/lib/game-api';
import type {
  CurrentGame,
  PawnhouseGameState,
  PawnhouseTimeline,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

export function timelineCursor(
  current: number,
  events: PawnhouseTimelineEvent[],
  nextAfter?: number,
): number {
  let cursor = Math.max(0, current, Number(nextAfter) || 0);
  for (const event of events) {
    cursor = Math.max(cursor, Number(event.sequence) || 0);
  }
  return cursor;
}

export function mergeTimelineEvents(
  current: PawnhouseTimelineEvent[],
  incoming: PawnhouseTimelineEvent[],
  limit = 1_000,
): PawnhouseTimelineEvent[] {
  if (incoming.length === 0) return current;
  const bySequence = new Map<number, PawnhouseTimelineEvent>();
  for (const event of current) bySequence.set(event.sequence, event);
  for (const event of incoming) bySequence.set(event.sequence, event);
  return [...bySequence.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-Math.max(1, limit));
}

export type LiveGameFeedSource = 'initializing' | 'sse' | 'poll';
export type LiveGameFeedError = 'unavailable' | null;

export interface LiveGameFeedSnapshot {
  gameId: string;
  state: PawnhouseGameState | null;
  currentGame: CurrentGame | null;
  events: PawnhouseTimelineEvent[];
  cursor: number;
  source: LiveGameFeedSource;
  delayed: boolean;
  error: LiveGameFeedError;
  lastUpdatedAt: number;
}

interface EventSourceMessage {
  data: string;
}

interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(
    type: string,
    listener: (message: EventSourceMessage) => void,
  ): void;
  close(): void;
}

export interface LiveGameFeedAdapters {
  loadState(
    gameId: string,
    signal?: AbortSignal,
  ): Promise<PawnhouseGameState>;
  loadTimeline(
    gameId: string,
    after: number,
    signal?: AbortSignal,
  ): Promise<PawnhouseTimeline>;
  loadCurrentGame(signal?: AbortSignal): Promise<CurrentGame | null>;
  createEventSource(url: string): EventSourceLike;
  setInterval(callback: () => void, milliseconds: number): ReturnType<typeof setInterval>;
  clearInterval(timer: ReturnType<typeof setInterval>): void;
  setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
  now(): number;
}

export interface StartLiveGameFeedOptions {
  gameId: string;
  onSnapshot(snapshot: LiveGameFeedSnapshot): void;
  includeState?: boolean;
  includeCurrentGame?: boolean;
  useServerSentEvents?: boolean;
  eventLimit?: number;
  pollIntervalMs?: number;
  stateRefreshDelayMs?: number;
}

function productionAdapters(): LiveGameFeedAdapters {
  return {
    loadState: getPawnhouseGame,
    loadTimeline: getPawnhouseTimeline,
    loadCurrentGame: async (signal) => {
      try {
        return (await getCurrentGame(signal)).game;
      } catch {
        return null;
      }
    },
    createEventSource: (url) => new EventSource(url),
    setInterval: (callback, milliseconds) =>
      globalThis.setInterval(callback, milliseconds),
    clearInterval: (timer) => globalThis.clearInterval(timer),
    setTimeout: (callback, milliseconds) =>
      globalThis.setTimeout(callback, milliseconds),
    clearTimeout: (timer) => globalThis.clearTimeout(timer),
    now: () => Date.now(),
  };
}

export function startLiveGameFeed(
  options: StartLiveGameFeedOptions,
  adapterOverrides: Partial<LiveGameFeedAdapters> = {},
): () => void {
  const adapters = { ...productionAdapters(), ...adapterOverrides };
  const {
    gameId,
    onSnapshot,
    includeState = true,
    includeCurrentGame = false,
    useServerSentEvents = true,
    eventLimit = 1_000,
    pollIntervalMs = 3_000,
    stateRefreshDelayMs = 250,
  } = options;
  const controller = new AbortController();
  let stopped = false;
  let requestRunning = false;
  let hasSnapshot = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let stateRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  let eventSource: EventSourceLike | undefined;
  let snapshot: LiveGameFeedSnapshot = {
    gameId,
    state: null,
    currentGame: null,
    events: [],
    cursor: 0,
    source: 'initializing',
    delayed: false,
    error: null,
    lastUpdatedAt: 0,
  };

  function emit(patch: Partial<LiveGameFeedSnapshot>) {
    if (stopped) return;
    snapshot = {
      ...snapshot,
      ...patch,
      gameId,
      events: patch.events ? [...patch.events] : snapshot.events,
    };
    onSnapshot(snapshot);
  }

  function mergeEvents(
    incoming: PawnhouseTimelineEvent[],
    nextAfter?: number,
  ) {
    const cursor = timelineCursor(snapshot.cursor, incoming, nextAfter);
    const events = mergeTimelineEvents(snapshot.events, incoming, eventLimit);
    emit({ cursor, events });
  }

  async function refreshState() {
    if (!includeState || stopped) return;
    try {
      const state = await adapters.loadState(gameId, controller.signal);
      emit({
        state,
        delayed: false,
        error: null,
        lastUpdatedAt: adapters.now(),
      });
    } catch {
      if (!stopped) emit({ delayed: hasSnapshot, error: hasSnapshot ? null : 'unavailable' });
    }
  }

  async function refreshAll(source: LiveGameFeedSource = 'poll') {
    if (requestRunning || stopped) return;
    requestRunning = true;
    try {
      const [state, timeline, currentGame] = await Promise.all([
        includeState
          ? adapters.loadState(gameId, controller.signal)
          : Promise.resolve(snapshot.state),
        adapters.loadTimeline(gameId, snapshot.cursor, controller.signal),
        includeCurrentGame
          ? adapters.loadCurrentGame(controller.signal)
          : Promise.resolve(snapshot.currentGame),
      ]);
      if (stopped) return;
      hasSnapshot = true;
      const events = mergeTimelineEvents(
        snapshot.events,
        timeline.events,
        eventLimit,
      );
      emit({
        state,
        currentGame:
          currentGame?.gameId === gameId ? currentGame : null,
        events,
        cursor: timelineCursor(
          snapshot.cursor,
          timeline.events,
          timeline.nextAfter,
        ),
        source,
        delayed: false,
        error: null,
        lastUpdatedAt: adapters.now(),
      });
    } catch {
      if (!stopped) {
        emit({
          delayed: hasSnapshot,
          error: hasSnapshot ? null : 'unavailable',
        });
      }
    } finally {
      requestRunning = false;
    }
  }

  function startPolling(markDelayed = true) {
    if (pollTimer !== undefined || stopped) return;
    emit({ source: 'poll', delayed: markDelayed });
    pollTimer = adapters.setInterval(
      () => void refreshAll('poll'),
      pollIntervalMs,
    );
  }

  function stopPolling() {
    if (pollTimer === undefined) return;
    adapters.clearInterval(pollTimer);
    pollTimer = undefined;
  }

  void refreshAll('initializing').then(() => {
    if (stopped) return;
    const eventSourceAvailable =
      Boolean(adapterOverrides.createEventSource) ||
      typeof EventSource !== 'undefined';
    if (!useServerSentEvents || !eventSourceAvailable) {
      startPolling(false);
      return;
    }
    eventSource = adapters.createEventSource(
      getPawnhouseEventsUrl(gameId, snapshot.cursor),
    );
    eventSource.onopen = () => {
      stopPolling();
      emit({ source: 'sse', delayed: false, error: null });
    };
    eventSource.onerror = () => startPolling(true);
    eventSource.addEventListener('arena', (message) => {
      try {
        const event = decodePawnhouseTimelineEvent(JSON.parse(message.data));
        mergeEvents([event]);
        if (stateRefreshTimer !== undefined) {
          adapters.clearTimeout(stateRefreshTimer);
        }
        stateRefreshTimer = adapters.setTimeout(
          () => void refreshState(),
          stateRefreshDelayMs,
        );
      } catch {
        // A malformed public record must not terminate the live connection.
      }
    });
  });

  return () => {
    stopped = true;
    controller.abort();
    eventSource?.close();
    stopPolling();
    if (stateRefreshTimer !== undefined) {
      adapters.clearTimeout(stateRefreshTimer);
    }
  };
}
