import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

export type ArenaMarketProtocol = 'fcfs.v1' | 'agent_a2a.v1';

export interface PublicMarketOrder {
  sequence: number;
  participantId: string;
  side: string;
  goodId: string;
  quantity: number;
  publicPriceAtomic: number | null;
}

function value(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

export function resolveMarketProtocol(
  state: Partial<PawnhouseGameState> | null,
  events: PawnhouseTimelineEvent[],
): ArenaMarketProtocol {
  const explicit = String(
    value(
      state as Record<string, unknown> | undefined,
      'marketProtocol',
      'market_protocol',
    ) || '',
  );
  if (explicit === 'agent_a2a.v1') return explicit;
  if (
    events.some((event) =>
      event.type.startsWith('market.')
      && event.type !== 'market.price_snapshot',
    )
  ) {
    return 'agent_a2a.v1';
  }
  return 'fcfs.v1';
}

function currentRoundEvents(
  state: Partial<PawnhouseGameState> | null,
  events: PawnhouseTimelineEvent[],
): PawnhouseTimelineEvent[] {
  const currentRound = Number(state?.currentRound || 0);
  const roundStart = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'round.started'
        && Number(value(event.data, 'round', 'roundIndex', 'round_index'))
          === currentRound,
    );
  if (roundStart) {
    return events.filter((event) => event.sequence >= roundStart.sequence);
  }
  return events.filter(
    (event) =>
      Number(value(event.data, 'round', 'roundIndex', 'round_index'))
        === currentRound,
  );
}

export function projectCurrentRoundMarket(
  state: Partial<PawnhouseGameState> | null,
  events: PawnhouseTimelineEvent[],
): {
  protocol: ArenaMarketProtocol;
  events: PawnhouseTimelineEvent[];
  orders: PublicMarketOrder[];
  engagedParticipantIds: Set<string>;
} {
  const protocol = resolveMarketProtocol(state, events);
  const roundEvents = currentRoundEvents(state, events);
  const orderTypes = protocol === 'agent_a2a.v1'
    ? ['market.intent_published']
    : ['order.queued', 'decision.applied'];
  const orders = roundEvents
    .filter((event) => orderTypes.includes(event.type))
    .map((event) => {
      const publicPrice = Number(
        value(
          event.data,
          'publicPriceAtomic',
          'public_price_atomic',
          'priceAtomic',
          'price_atomic',
        ),
      );
      return {
        sequence: event.sequence,
        participantId: String(
          value(
            event.data,
            'participantId',
            'participant_id',
            'agentId',
            'agent_id',
          ) || '',
        ),
        side: String(
          value(event.data, 'side', 'action', 'intent') || '',
        ).toLowerCase(),
        goodId: String(
          value(event.data, 'goodId', 'good_id', 'good') || '',
        ).toLowerCase(),
        quantity: Number(value(event.data, 'quantity', 'qty') || 0),
        publicPriceAtomic: Number.isFinite(publicPrice) ? publicPrice : null,
      };
    });
  const engagedParticipantIds = new Set<string>();
  for (const event of roundEvents) {
    if (
      !['pairing.created', 'market.engagement_created'].includes(event.type)
    ) {
      continue;
    }
    for (const participantId of [
      value(
        event.data,
        'buyerParticipantId',
        'buyer_participant_id',
        'buyerAgentId',
        'buyer_agent_id',
      ),
      value(
        event.data,
        'sellerParticipantId',
        'seller_participant_id',
        'sellerAgentId',
        'seller_agent_id',
      ),
    ]) {
      if (participantId) engagedParticipantIds.add(String(participantId));
    }
  }
  return {
    protocol,
    events: roundEvents,
    orders,
    engagedParticipantIds,
  };
}
