import type { PawnhouseTimelineEvent } from '@/lib/game-api';

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
