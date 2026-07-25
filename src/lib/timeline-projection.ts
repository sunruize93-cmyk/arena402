interface TimelineEventLike {
  sequence: number;
  type: string;
  data?: Record<string, unknown>;
}

type SnapshotLike = Record<string, unknown>;

function pick(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function pairingId(event: TimelineEventLike): string {
  const value = pick(event.data, 'pairingId', 'pairing_id');
  return typeof value === 'string' && value ? value : `pair-${event.sequence}`;
}

function roundIndex(record: Record<string, unknown> | undefined): number | null {
  const value = Number(pick(record, 'round', 'roundIndex', 'round_index'));
  return Number.isFinite(value) ? value : null;
}

export function activePairingIds(events: TimelineEventLike[]): string[] {
  const closed = new Set(
    events
      .filter((event) => event.type === 'pairing.closed')
      .map(pairingId),
  );

  return events
    .filter((event) => event.type === 'pairing.created')
    .filter((event) => !closed.has(pairingId(event)))
    .sort((left, right) => right.sequence - left.sequence)
    .map(pairingId);
}

export function visibleReplaySnapshots<T extends SnapshotLike>(
  snapshots: T[],
  visibleEvents: TimelineEventLike[],
): T[] {
  const closedRounds = new Set<number>();
  let currentRound: number | null = null;

  for (const event of visibleEvents) {
    if (event.type === 'round.started') {
      currentRound = roundIndex(event.data);
    }
    if (event.type === 'round.closed') {
      const closedRound = roundIndex(event.data) ?? currentRound;
      if (closedRound !== null) closedRounds.add(closedRound);
    }
  }

  return snapshots.filter((snapshot) => {
    const snapshotRound = roundIndex(snapshot);
    return snapshotRound !== null && closedRounds.has(snapshotRound);
  });
}
