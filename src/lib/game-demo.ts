import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

export const DEMO_INITIAL_EVENT_COUNT = 6;

// Presentation-only fixture for /game/demo. Live game state continues to come
// exclusively from the Arena HTTP API.
export const DEMO_PARTICIPANTS = [
  { agent_id: 'cassius', runtime_kind: 'hosted', status: 'active' },
  { agent_id: 'livia', runtime_kind: 'hosted', status: 'active' },
  { agent_id: 'marius', runtime_kind: 'remote', status: 'active' },
  { agent_id: 'octavia', runtime_kind: 'remote', status: 'active' },
];

export interface DemoPlaybackPosition {
  roundIndex: number;
  eventCount: number;
}

export interface DemoRound {
  number: number;
  eventId: string;
  pairingId: string;
  events: PawnhouseTimelineEvent[];
}

interface DemoRoundConfig {
  eventId: string;
  goodId: 'grain' | 'iron' | 'warhorse' | 'gems';
  buyer: string;
  seller: string;
  observer: string;
  openingPrice: string;
  sellerPrice: string;
  finalPrice: string;
  openingMessage: string;
  sellerMessage: string;
  finalMessage: string;
  outcome: 'accept' | 'reject';
}

const ROUND_CONFIGS: DemoRoundConfig[] = [
  {
    eventId: 'granary-fire',
    goodId: 'grain',
    buyer: 'cassius',
    seller: 'livia',
    observer: 'marius',
    openingPrice: '2700000',
    sellerPrice: '3100000',
    finalPrice: '2900000',
    openingMessage: 'Two sacks before the northern gate closes.',
    sellerMessage: 'Scarcity has its price. Three and one tenth.',
    finalMessage: 'Two and nine. Paid now, before the city wakes.',
    outcome: 'accept',
  },
  {
    eventId: 'palace-requisition',
    goodId: 'iron',
    buyer: 'marius',
    seller: 'octavia',
    observer: 'cassius',
    openingPrice: '5600000',
    sellerPrice: '6400000',
    finalPrice: '6100000',
    openingMessage: 'The northern forge needs every bar you can spare.',
    sellerMessage: 'The Crown is already paying above six.',
    finalMessage: 'Six and one. Immediate authorization.',
    outcome: 'accept',
  },
  {
    eventId: 'stable-plague',
    goodId: 'warhorse',
    buyer: 'livia',
    seller: 'marius',
    observer: 'octavia',
    openingPrice: '6900000',
    sellerPrice: '8200000',
    finalPrice: '7400000',
    openingMessage: 'One sound horse is worth a company on foot.',
    sellerMessage: 'Sound animals are almost gone. Eight and two.',
    finalMessage: 'Seven and four is the edge of reason.',
    outcome: 'reject',
  },
  {
    eventId: 'noble-gem-fever',
    goodId: 'gems',
    buyer: 'octavia',
    seller: 'cassius',
    observer: 'livia',
    openingPrice: '4400000',
    sellerPrice: '5100000',
    finalPrice: '4800000',
    openingMessage: 'The wedding court is buying before sunset.',
    sellerMessage: 'Every noble in Aurelia has heard the same rumor.',
    finalMessage: 'Four and eight. Settlement now.',
    outcome: 'accept',
  },
  {
    eventId: 'merchant-caravan',
    goodId: 'grain',
    buyer: 'marius',
    seller: 'livia',
    observer: 'cassius',
    openingPrice: '2400000',
    sellerPrice: '2800000',
    finalPrice: '2600000',
    openingMessage: 'The caravan broke the blockade. I can wait.',
    sellerMessage: 'The southern road may close again by dawn.',
    finalMessage: 'Two and six closes the book.',
    outcome: 'accept',
  },
];

function occurredAt(round: number, offset: number): string {
  return new Date(Date.UTC(2026, 6, 25, 4, round * 6, offset * 3)).toISOString();
}

function buildRound(config: DemoRoundConfig, index: number): DemoRound {
  const number = index + 1;
  const pairingId = `pair-${String(number).padStart(2, '0')}-a`;
  const sequenceBase = number * 100;
  const event = (
    offset: number,
    type: string,
    data: Record<string, unknown>,
  ): PawnhouseTimelineEvent => ({
    sequence: sequenceBase + offset,
    type,
    data,
    occurredAt: occurredAt(number, offset),
  });
  const events: PawnhouseTimelineEvent[] = [
    event(1, 'round.started', { roundIndex: number }),
    event(2, 'world.event_revealed', {
      eventId: config.eventId,
      round: number,
    }),
    event(3, 'decision.applied', {
      agentId: config.buyer,
      action: 'buy',
      goodId: config.goodId,
    }),
    event(4, 'decision.applied', {
      agentId: config.seller,
      action: 'sell',
      goodId: config.goodId,
    }),
    event(5, 'decision.applied', {
      agentId: config.observer,
      action: 'pass',
    }),
    event(6, 'pairing.created', {
      pairingId,
      buyerAgentId: config.buyer,
      sellerAgentId: config.seller,
      goodId: config.goodId,
    }),
    event(7, 'negotiation.message', {
      pairingId,
      actorAgentId: config.buyer,
      action: 'propose',
      priceAtomic: config.openingPrice,
      quantity: 1,
      message: config.openingMessage,
    }),
    event(8, 'negotiation.message', {
      pairingId,
      actorAgentId: config.seller,
      action: 'counter',
      priceAtomic: config.sellerPrice,
      quantity: 1,
      message: config.sellerMessage,
    }),
    event(9, 'negotiation.message', {
      pairingId,
      actorAgentId: config.buyer,
      action: 'counter',
      priceAtomic: config.finalPrice,
      quantity: 1,
      message: config.finalMessage,
    }),
    event(10, 'negotiation.message', {
      pairingId,
      actorAgentId: config.seller,
      action: config.outcome,
      priceAtomic: config.finalPrice,
      quantity: 1,
    }),
  ];

  if (config.outcome === 'accept') {
    events.push(
      event(11, 'settlement.intent_frozen', {
        pairingId,
        amountAtomic: config.finalPrice,
      }),
      event(12, 'settlement.approved', { pairingId }),
      event(13, 'settlement.chain_confirmed', {
        pairingId,
        txHash: `0x402${number}c7a9d…f${number}e8`,
      }),
      event(14, 'settlement.inventory_committed', { pairingId }),
      event(15, 'round.closed', { roundIndex: number }),
    );
  } else {
    events.push(event(11, 'round.closed', { roundIndex: number }));
  }

  return {
    number,
    eventId: config.eventId,
    pairingId,
    events,
  };
}

export const DEMO_ROUNDS: DemoRound[] = ROUND_CONFIGS.map(buildRound);

export function buildDemoGameState(
  round: DemoRound,
  visibleEvents: PawnhouseTimelineEvent[],
): PawnhouseGameState {
  const closed = visibleEvents.some((event) => event.type === 'round.closed');
  const settling = visibleEvents.some((event) =>
    event.type.startsWith('settlement.'),
  );
  const paired = visibleEvents.some((event) => event.type === 'pairing.created');
  const currentPhase = closed
    ? 'closed'
    : settling
      ? 'settling'
      : paired
        ? 'negotiating'
        : 'deciding';

  return {
    gameId: 'demo',
    phase: 'running',
    currentRound: round.number,
    roundCount: DEMO_ROUNDS.length,
    eventScheduleCommitment: '0x402d7c88a33b7a16',
    participants: DEMO_PARTICIPANTS,
    rounds: DEMO_ROUNDS.map((candidate) => ({
      round_index: candidate.number,
      phase:
        candidate.number < round.number
          ? 'closed'
          : candidate.number === round.number
            ? currentPhase
            : 'registration',
    })),
    schemaVersion: 'arena.pawnhouse-game-state.v1',
  };
}

export function advanceDemoPlayback(
  position: DemoPlaybackPosition,
): DemoPlaybackPosition {
  const round = DEMO_ROUNDS[position.roundIndex] || DEMO_ROUNDS[0];
  const nextEvent = round.events[position.eventCount];
  if (nextEvent && nextEvent.type !== 'round.closed') {
    return {
      roundIndex: position.roundIndex,
      eventCount: position.eventCount + 1,
    };
  }
  return {
    roundIndex: (position.roundIndex + 1) % DEMO_ROUNDS.length,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  };
}
