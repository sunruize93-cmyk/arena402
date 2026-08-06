interface TimelineEventLike {
  sequence: number;
  type: string;
  data?: Record<string, unknown>;
  roundId?: string | null;
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

function pairingIdFromNegotiation(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('neg:') && value.length > 4) {
    return value.slice(4);
  }
  if (value.startsWith('negotiation:') && value.length > 12) {
    return `pairing:engagement:${value.slice('negotiation:'.length)}`;
  }
  return value;
}

function pairingIdFromSettlement(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (
    value.startsWith('settlement:negotiation:')
    && value.length > 'settlement:negotiation:'.length
  ) {
    return `pairing:engagement:${value.slice('settlement:negotiation:'.length)}`;
  }
  return null;
}

function explicitPairingId(event: TimelineEventLike): string | null {
  const value = pick(event.data, 'pairingId', 'pairing_id');
  if (typeof value === 'string' && value) return value;
  const engagement = pick(event.data, 'engagementId', 'engagement_id');
  if (typeof engagement === 'string' && engagement) {
    return engagement.startsWith('pairing:')
      ? engagement
      : `pairing:${engagement}`;
  }
  const negotiation = pairingIdFromNegotiation(
    pick(event.data, 'negotiationId', 'negotiation_id'),
  );
  if (negotiation) return negotiation;
  const settlement = pairingIdFromSettlement(
    pick(event.data, 'settlementIntentId', 'settlement_intent_id'),
  );
  if (settlement) return settlement;
  const request = pick(event.data, 'requestId', 'request_id');
  if (typeof request === 'string' && request) {
    return `pairing:engagement:${request}`;
  }
  return null;
}

function pairingId(event: TimelineEventLike): string {
  return explicitPairingId(event) || `pair-${event.sequence}`;
}

export function timelinePairingId(event: TimelineEventLike): string {
  return pairingId(event);
}

function matchesPairing(event: TimelineEventLike, targetPairingId: string): boolean {
  return explicitPairingId(event) === targetPairingId;
}

function pairingRoundId(event: TimelineEventLike): string | null {
  const value =
    event.roundId
    ?? pick(event.data, 'roundId', 'round_id');
  return typeof value === 'string' && value ? value : null;
}

function normalizedStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

const CLOSED_PAIRING_STATUSES = new Set([
  'rejected',
  'timeout',
  'settled',
  'settlement_failed',
  'closed',
  'completed',
]);

const NON_NEGOTIATING_PAIRING_STATUSES = new Set([
  ...CLOSED_PAIRING_STATUSES,
  'accepted',
  'accepted_pending_settlement',
  'settling',
]);

const CLOSED_SETTLEMENT_EVENTS = new Set([
  'settlement.authorization_failed',
  'settlement.inventory_committed',
  'settlement.reverted',
]);

export function isPairingClosed(
  events: TimelineEventLike[],
  targetPairingId: string,
  status?: unknown,
): boolean {
  if (CLOSED_PAIRING_STATUSES.has(normalizedStatus(status))) return true;

  const created = events.find(
    (event) =>
      ['pairing.created', 'market.engagement_created'].includes(event.type)
      && pairingId(event) === targetPairingId,
  );
  const createdRoundId = created ? pairingRoundId(created) : null;

  return events.some((event) => {
    if (event.type === 'game.completed') return true;
    if (
      event.type === 'round.closed'
      && createdRoundId !== null
      && pairingRoundId(event) === createdRoundId
    ) {
      return true;
    }
    if (!matchesPairing(event, targetPairingId)) return false;
    if (event.type === 'pairing.closed') return true;
    if (CLOSED_SETTLEMENT_EVENTS.has(event.type)) return true;
    if (event.type !== 'negotiation.message') return false;
    return normalizedStatus(pick(event.data, 'action', 'type')) === 'reject';
  });
}

export function isPairingAwaitingAgentAction(
  events: TimelineEventLike[],
  targetPairingId: string,
  status?: unknown,
): boolean {
  if (NON_NEGOTIATING_PAIRING_STATUSES.has(normalizedStatus(status))) {
    return false;
  }
  if (isPairingClosed(events, targetPairingId, status)) return false;

  const related = events.filter(
    (event) =>
      event.type === 'negotiation.message'
      && matchesPairing(event, targetPairingId),
  );
  const lastAction = normalizedStatus(
    pick(related.at(-1)?.data, 'action', 'type'),
  );
  if (lastAction === 'accept' || lastAction === 'reject') return false;

  return !events.some(
    (event) =>
      event.type.startsWith('settlement.')
      && matchesPairing(event, targetPairingId),
  );
}

function roundIndex(record: Record<string, unknown> | undefined): number | null {
  const value = Number(pick(record, 'round', 'roundIndex', 'round_index'));
  return Number.isFinite(value) ? value : null;
}

export function activePairingIds(events: TimelineEventLike[]): string[] {
  return events
    .filter((event) =>
      ['pairing.created', 'market.engagement_created'].includes(event.type),
    )
    .filter((event) => !isPairingClosed(events, pairingId(event)))
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
