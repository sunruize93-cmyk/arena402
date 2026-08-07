import type { PawnhouseTimelineEvent } from '@/lib/game-api';
import { timelinePairingId } from '@/lib/timeline-projection';

export type TradeThreadStatus =
  | 'rfq'
  | 'engaged'
  | 'negotiating'
  | 'deal'
  | 'authorizing'
  | 'submitted'
  | 'confirmed'
  | 'settled'
  | 'rejected'
  | 'failed'
  | 'expired';

export interface TradeThread {
  id: string;
  pairingId: string;
  requestId: string;
  roundId: string;
  roundIndex: number;
  buyerId: string;
  sellerId: string;
  goodId: string;
  status: TradeThreadStatus;
  stageIndex: number;
  turnCount: number;
  rfqAttempt: number;
  agreedPriceAtomic: string;
  txHash: string;
  latestSequence: number;
  active: boolean;
}

interface MutableTradeThread extends TradeThread {
  engaged: boolean;
}

const TERMINAL_STATUSES = new Set<TradeThreadStatus>([
  'settled',
  'rejected',
  'failed',
  'expired',
]);

function value(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function text(input: unknown): string {
  if (typeof input !== 'string' && typeof input !== 'number') return '';
  return String(input).trim();
}

function integer(input: unknown): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function requestIds(data: Record<string, unknown>): string[] {
  const plural = value(data, 'requestIds', 'request_ids');
  if (Array.isArray(plural)) {
    return plural.map(text).filter(Boolean);
  }
  const singular = text(value(data, 'requestId', 'request_id'));
  return singular ? [singular] : [];
}

function requestIdFromPairing(pairingId: string): string {
  const prefix = 'pairing:engagement:';
  return pairingId.startsWith(prefix) ? pairingId.slice(prefix.length) : '';
}

function stageIndex(status: TradeThreadStatus): number {
  if (status === 'rfq' || status === 'expired') return 0;
  if (status === 'engaged') return 1;
  if (status === 'negotiating' || status === 'rejected') return 2;
  if (status === 'deal') return 3;
  return 4;
}

function createThread(
  id: string,
  event: PawnhouseTimelineEvent,
  roundIndex: number,
  overrides: Partial<MutableTradeThread> = {},
): MutableTradeThread {
  return {
    id,
    pairingId: '',
    requestId: '',
    roundId: event.roundId || '',
    roundIndex,
    buyerId: '',
    sellerId: '',
    goodId: '',
    status: 'rfq',
    stageIndex: 0,
    turnCount: 0,
    rfqAttempt: 0,
    agreedPriceAtomic: '',
    txHash: '',
    latestSequence: event.sequence,
    active: true,
    engaged: false,
    ...overrides,
  };
}

function updateStatus(
  thread: MutableTradeThread,
  status: TradeThreadStatus,
): void {
  thread.status = status;
  thread.stageIndex = stageIndex(status);
  thread.active = !TERMINAL_STATUSES.has(status);
}

function eventRoundIndexes(events: PawnhouseTimelineEvent[]): Map<number, number> {
  const roundById = new Map<string, number>();
  const result = new Map<number, number>();
  let currentRound = 0;

  for (const event of events) {
    if (event.type === 'round.started') {
      currentRound = integer(value(event.data, 'round', 'roundIndex', 'round_index'));
      if (event.roundId && currentRound) roundById.set(event.roundId, currentRound);
    }
    const explicit = integer(value(event.data, 'round', 'roundIndex', 'round_index'));
    const round = explicit || (event.roundId ? roundById.get(event.roundId) || 0 : 0) || currentRound;
    result.set(event.sequence, round);
  }
  return result;
}

/**
 * Build public, replay-safe interaction threads from Arena timeline events.
 * The projector never invents a seller for an RFQ that did not become an
 * engagement, and it treats inventory commit—not negotiation acceptance—as
 * the completed trade boundary.
 */
export function buildTradeThreads(
  sourceEvents: PawnhouseTimelineEvent[],
): TradeThread[] {
  const events = [...sourceEvents].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const rounds = eventRoundIndexes(events);
  const intents = new Map<
    string,
    { participantId: string; goodId: string; roundId: string; roundIndex: number }
  >();
  const threads = new Map<string, MutableTradeThread>();
  const requestToThread = new Map<string, string>();

  function relatedThread(event: PawnhouseTimelineEvent): MutableTradeThread | null {
    const pairingId = timelinePairingId(event);
    const direct = threads.get(pairingId);
    if (direct) return direct;
    const requestId = text(value(event.data, 'requestId', 'request_id'))
      || requestIdFromPairing(pairingId);
    const mapped = requestId ? requestToThread.get(requestId) : '';
    return mapped ? threads.get(mapped) || null : null;
  }

  for (const event of events) {
    const data = event.data || {};
    const roundIndex = rounds.get(event.sequence) || 0;

    if (event.type === 'market.intent_published') {
      const intentId = text(value(data, 'intentId', 'intent_id'));
      if (intentId) {
        intents.set(intentId, {
          participantId: text(
            value(data, 'participantId', 'participant_id', 'agentId', 'agent_id'),
          ),
          goodId: text(value(data, 'goodId', 'good_id', 'good')).toLowerCase(),
          roundId: event.roundId || '',
          roundIndex,
        });
      }
      continue;
    }

    if (event.type === 'market.rfq_sent') {
      const buyerIntentId = text(value(data, 'buyerIntentId', 'buyer_intent_id'));
      const intent = intents.get(buyerIntentId);
      for (const requestId of requestIds(data)) {
        const id = `pairing:engagement:${requestId}`;
        if (threads.has(id)) continue;
        threads.set(
          id,
          createThread(id, event, intent?.roundIndex || roundIndex, {
            requestId,
            roundId: intent?.roundId || event.roundId || '',
            buyerId: intent?.participantId || '',
            goodId: intent?.goodId || '',
            rfqAttempt: integer(
              value(data, 'attemptSequence', 'attempt_sequence', 'attempt'),
            ),
          }),
        );
        requestToThread.set(requestId, id);
      }
      continue;
    }

    if (
      event.type === 'pairing.created'
      || event.type === 'market.engagement_created'
    ) {
      const pairingId = timelinePairingId(event);
      const requestId = text(value(data, 'requestId', 'request_id'))
        || requestIdFromPairing(pairingId);
      const existingId = requestToThread.get(requestId) || pairingId;
      let thread = threads.get(existingId);
      if (!thread) {
        thread = createThread(pairingId, event, roundIndex);
        threads.set(pairingId, thread);
      }
      thread.pairingId = pairingId;
      thread.requestId = requestId || thread.requestId;
      thread.roundId = event.roundId || thread.roundId;
      thread.roundIndex = roundIndex || thread.roundIndex;
      thread.buyerId = text(
        value(
          data,
          'buyerParticipantId',
          'buyer_participant_id',
          'buyerAgentId',
          'buyer_agent_id',
        ),
      ) || thread.buyerId;
      thread.sellerId = text(
        value(
          data,
          'sellerParticipantId',
          'seller_participant_id',
          'sellerAgentId',
          'seller_agent_id',
        ),
      );
      thread.goodId = text(value(data, 'goodId', 'good_id', 'good')).toLowerCase()
        || thread.goodId;
      thread.latestSequence = event.sequence;
      thread.engaged = true;
      updateStatus(thread, 'engaged');
      if (requestId) requestToThread.set(requestId, thread.id);
      continue;
    }

    if (event.type === 'round.closed') {
      for (const thread of threads.values()) {
        if (
          !thread.engaged
          && thread.active
          && (
            (event.roundId && thread.roundId === event.roundId)
            || (roundIndex && thread.roundIndex === roundIndex)
          )
        ) {
          thread.latestSequence = event.sequence;
          updateStatus(thread, 'expired');
        }
      }
      continue;
    }

    const thread = relatedThread(event);
    if (!thread) continue;
    thread.latestSequence = event.sequence;

    if (event.type === 'market.negotiation_created') {
      updateStatus(thread, 'negotiating');
    } else if (event.type === 'negotiation.message') {
      thread.turnCount += 1;
      const action = text(value(data, 'action', 'type')).toLowerCase();
      const price = text(value(data, 'priceAtomic', 'price_atomic', 'price'));
      if (price) thread.agreedPriceAtomic = price;
      if (action === 'accept') updateStatus(thread, 'deal');
      else if (action === 'reject') updateStatus(thread, 'rejected');
      else updateStatus(thread, 'negotiating');
    } else if (event.type === 'market.deal_frozen') {
      const price = text(value(data, 'priceAtomic', 'price_atomic', 'price'));
      if (price) thread.agreedPriceAtomic = price;
      updateStatus(thread, 'deal');
    } else if (
      event.type === 'settlement.intent_frozen'
      || event.type === 'settlement.approved'
    ) {
      const amount = text(value(data, 'amountAtomic', 'amount_atomic', 'amount'));
      if (amount) thread.agreedPriceAtomic = amount;
      updateStatus(thread, 'authorizing');
    } else if (event.type === 'settlement.submitted') {
      thread.txHash = text(
        value(data, 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash'),
      ) || thread.txHash;
      updateStatus(thread, 'submitted');
    } else if (event.type === 'settlement.chain_confirmed') {
      thread.txHash = text(
        value(data, 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash'),
      ) || thread.txHash;
      updateStatus(thread, 'confirmed');
    } else if (event.type === 'settlement.inventory_committed') {
      updateStatus(thread, 'settled');
    } else if (
      event.type === 'settlement.reverted'
      || event.type === 'settlement.confirmation_timeout'
      || event.type === 'settlement.failed'
      || event.type === 'settlement.authorization_failed'
    ) {
      updateStatus(thread, 'failed');
    } else if (event.type === 'pairing.closed') {
      const status = text(value(data, 'status')).toLowerCase();
      if (status === 'settled') updateStatus(thread, 'settled');
      else if (status.includes('fail')) updateStatus(thread, 'failed');
      else if (status === 'rejected' || status === 'timeout') {
        updateStatus(thread, 'rejected');
      }
    }
  }

  return [...threads.values()]
    .sort((left, right) => right.latestSequence - left.latestSequence)
    .map(({ engaged: _engaged, ...thread }) => thread);
}
