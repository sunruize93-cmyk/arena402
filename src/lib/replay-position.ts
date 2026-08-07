import type { PawnhouseTimelineEvent } from '@/lib/game-api';

function positiveRound(value: unknown): number | null {
  const round = Number(value);
  return Number.isInteger(round) && round > 0 ? round : null;
}

export function timelineEventRound(
  event: PawnhouseTimelineEvent | undefined,
): number | null {
  if (!event) return null;
  const dataRound =
    positiveRound(event.data?.round)
    ?? positiveRound(event.data?.roundIndex)
    ?? positiveRound(event.data?.round_index);
  if (dataRound !== null) return dataRound;

  const match = String(event.roundId || '').match(/:(\d+)$/);
  return match ? positiveRound(match[1]) : null;
}

export function buildReplayRoundStarts(
  events: PawnhouseTimelineEvent[],
): Array<{ round: number; eventCount: number }> {
  const seen = new Set<number>();
  return events.reduce<Array<{ round: number; eventCount: number }>>(
    (starts, event, index) => {
      const round = timelineEventRound(event);
      if (round !== null && !seen.has(round)) {
        seen.add(round);
        starts.push({ round, eventCount: index + 1 });
      }
      return starts;
    },
    [],
  );
}

export function initialReplayEventCount(
  events: PawnhouseTimelineEvent[],
): number {
  return buildReplayRoundStarts(events)[0]?.eventCount ?? 1;
}
