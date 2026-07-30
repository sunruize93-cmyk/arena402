export type ProjectionRecord = Record<string, unknown>;

const CANONICAL_ALIASES = {
  actorAgentId: ['actor_agent_id'],
  agentId: ['agent_id'],
  amountAtomic: ['amount_atomic', 'amount'],
  buyerAgentId: ['buyer_agent_id'],
  buyerParticipantId: ['buyer_participant_id'],
  carriedForward: ['carried_forward'],
  closeAtomic: ['close_atomic', 'marketPriceAtomic', 'market_price_atomic', 'priceAtomic', 'price_atomic'],
  committedTradeCount: ['committed_trade_count', 'tradeCount'],
  createdAt: ['created_at'],
  currentRound: ['current_round'],
  displayName: ['display_name'],
  eventId: ['event_id'],
  gameId: ['game_id'],
  gameParticipantId: ['game_participant_id'],
  goodId: ['good_id', 'good'],
  highAtomic: ['high_atomic'],
  lastClearingAtomic: ['last_clearing_atomic'],
  lowAtomic: ['low_atomic'],
  negotiationId: ['negotiation_id'],
  netWorthAtomic: ['net_worth_atomic'],
  nextAfter: ['next_after'],
  occurredAt: ['occurred_at'],
  openAtomic: ['open_atomic'],
  pairingId: ['pairing_id'],
  participantId: ['participant_id'],
  previousRank: ['previous_rank'],
  priceAtomic: ['price_atomic', 'price'],
  priceSnapshots: [
    'price_snapshots',
    'priceHistory',
    'price_history',
    'marketPriceHistory',
    'market_price_history',
    'roundPrices',
    'round_prices',
  ],
  publicMessage: ['public_message'],
  roundCount: ['round_count'],
  roundId: ['round_id'],
  roundIndex: ['round_index', 'round'],
  runtimeKind: ['runtime_kind'],
  schemaVersion: ['schema_version'],
  sellerAgentId: ['seller_agent_id'],
  sellerParticipantId: ['seller_participant_id'],
  transactionHash: ['transaction_hash', 'txHash', 'tx_hash'],
  totalRounds: ['total_rounds'],
  liveRankings: ['live_rankings'],
} as const;

export function asProjectionRecord(value: unknown): ProjectionRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ProjectionRecord)
    : null;
}

/**
 * Normalize the backend's historical snake_case aliases once at the transport
 * seam. Original keys remain available for forward compatibility, while every
 * known field also receives one canonical camelCase key.
 */
export function normalizeProjectionRecord(
  value: unknown,
): ProjectionRecord | null {
  const record = asProjectionRecord(value);
  if (!record) return null;
  const normalized: ProjectionRecord = { ...record };
  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (normalized[canonical] !== undefined && normalized[canonical] !== null) {
      continue;
    }
    for (const alias of aliases) {
      if (record[alias] !== undefined && record[alias] !== null) {
        normalized[canonical] = record[alias];
        break;
      }
    }
  }
  return normalized;
}

export function normalizeProjectionArray(value: unknown): ProjectionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeProjectionRecord)
    .filter((record): record is ProjectionRecord => Boolean(record));
}

export function projectionValue(
  record: ProjectionRecord | null | undefined,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

export function publicProjectionText(
  value: unknown,
  fallback = '',
  maxLength = 180,
): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const clean = String(value)
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim();
  return clean ? clean.slice(0, maxLength) : fallback;
}

export function publicAgentName(
  value: unknown,
  fallback = 'Unknown Agent',
  maxLength = 120,
): string {
  return publicProjectionText(value, fallback, maxLength);
}
