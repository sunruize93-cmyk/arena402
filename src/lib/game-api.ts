import {
  API_BASE_URL,
  arenaApiRequest,
  ArenaApiError,
} from '@/lib/platform-api';
import type { InitialPortfolio } from '@/lib/initial-loadout';
import {
  normalizeProjectionArray,
  normalizeProjectionRecord,
  projectionValue,
} from '@/lib/public-projection';

export interface PawnhouseGameState {
  gameId: string;
  phase: string;
  currentRound?: number;
  totalRounds?: number;
  participants?: Array<Record<string, unknown>>;
  pools?: Array<Record<string, unknown>>;
  pairings?: Array<Record<string, unknown>>;
  negotiations?: Array<Record<string, unknown>>;
  settlements?: Array<Record<string, unknown>>;
  rankings?: Array<Record<string, unknown>>;
  rounds?: Array<Record<string, unknown>>;
  priceSnapshots?: Array<Record<string, unknown>>;
  liveRankings?: Array<Record<string, unknown>>;
  finalPrices?: Record<string, unknown>;
  roundCount?: number;
  eventScheduleCommitment?: string;
  schemaVersion: string;
  [key: string]: unknown;
}

export interface PawnhouseTimelineEvent {
  sequence: number;
  type: string;
  data: Record<string, unknown>;
  roundId?: string | null;
  occurredAt?: string;
  createdAt?: string;
}

export interface PawnhouseTimeline {
  gameId: string;
  events: PawnhouseTimelineEvent[];
  nextAfter: number;
  schemaVersion: string;
}

export interface GameParticipation {
  gameAgentId: string;
  gameId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeKind: string;
  status: string;
  configHash: string;
  schemaVersion: string;
}

export type CurrentGameStatus = 'WAITING' | 'RUNNING' | 'COMPLETED';

export interface AgentReputation {
  tradeAttempts: number;
  settledTrades: number;
  successRateBps: number | null;
  failedNegotiations: number;
}

export interface CurrentGameParticipant {
  participantId: string;
  agentId: string;
  displayName: string;
  runtimeKind: string;
  readiness: 'PENDING' | 'READY' | 'WITHDRAWN';
  joinedAt: string;
  isOfficial?: boolean;
  reputation?: AgentReputation;
}

export interface CurrentGameMatchmaking {
  targetSeats: number;
  humanReadyCount: number;
  officialReadyCount: number;
  firstHumanReadyAt: string | null;
  fillAt: string | null;
  fillStatus: 'IDLE' | 'COLLECTING' | 'FILLING' | 'READY' | 'BLOCKED';
  serverTime: string;
}

export interface CurrentGame {
  gameId: string;
  status: CurrentGameStatus;
  readyCount: number;
  startThreshold: number;
  maxParticipants: number;
  roundCount: number;
  currentRound: number;
  roundPhase: string | null;
  joinedByMe: boolean;
  participants: CurrentGameParticipant[];
  matchmaking: CurrentGameMatchmaking;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CurrentGameResponse {
  game: CurrentGame;
  nextGamePending: boolean;
  schemaVersion: 'arena.current-game.v1' | string;
}

interface GameParticipationList {
  participations: GameParticipation[];
  total: number;
}

export interface MandateRequirements {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  maxPerPaymentAtomic: string;
  maxCumulativeAtomic: string;
  allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT';
  expiresAt: string;
}

export interface JoinPreflight {
  gameId: string;
  agentId: string;
  eligible?: boolean;
  readyToJoin?: boolean;
  joinAuthorizationId: string;
  joinAuthorizationExpiresAt?: string;
  checks: Record<string, string>;
  mandateRequirements: MandateRequirements;
  portfolioRequirements?: {
    initialNetWorthAtomic: string;
    goldDecimals: number;
    allowedGoods: string[];
    defaultPortfolio: {
      cashAtomic: string;
      holdings: Record<string, number>;
    };
  };
  safeErrorCode: string | null;
  schemaVersion: string;
}

export function isJoinPreflightReady(
  preflight: Pick<
    JoinPreflight,
    | 'eligible'
    | 'readyToJoin'
    | 'joinAuthorizationId'
    | 'checks'
    | 'safeErrorCode'
    | 'schemaVersion'
  >,
): boolean {
  if (
    preflight.safeErrorCode !== null
    || preflight.eligible === false
    || preflight.readyToJoin === false
  ) {
    return false;
  }
  if (preflight.eligible === true && preflight.readyToJoin === true) {
    return true;
  }

  const legacySuccess =
    preflight.eligible === undefined
    && preflight.readyToJoin === undefined
    && preflight.schemaVersion === 'arena.game-join-preflight.v1'
    && preflight.joinAuthorizationId.length > 0
    && ['game', 'agent', 'runtime', 'wallet'].every(
      (check) => preflight.checks[check] === 'READY',
    );
  return legacySuccess;
}

export interface JoinCurrentGamePayload {
  agentId: string;
  joinAuthorizationId: string;
  paymentMandateId: string;
  portfolio?: InitialPortfolio;
}

export interface JoinCurrentGameResponse {
  participant?: CurrentGameParticipant;
  participantId?: string;
  gameId?: string;
  readiness?: 'PENDING' | 'READY';
  status?: CurrentGameStatus;
  gameStatus?: CurrentGameStatus;
  readyCount: number;
  startThreshold: number;
  portfolioLockedAt?: string;
  schemaVersion?: string;
}

export interface ArenaWallet {
  walletId: string;
  chainId: number;
  address: string;
  custodyMode: string;
  boundAt: string;
}

export interface PaymentMandate {
  mandateId: string;
  gameId: string;
  walletId?: string;
  chainId?: number;
  tokenAddress?: string;
  maxPerPaymentAtomic?: string;
  maxCumulativeAtomic?: string;
  reservedAtomic?: string;
  consumedAtomic?: string;
  allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT' | null;
  joinAuthorizationId: string | null;
  validFrom?: string;
  expiresAt: string;
  revokedAt?: string | null;
  status?: string;
}

export interface CreatePaymentMandatePayload {
  mandateId: string;
  gameId: string;
  joinAuthorizationId: string;
  chainId: number;
  tokenAddress: string;
  maxPerPaymentAtomic: string;
  maxCumulativeAtomic: string;
  allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT';
  validFrom: string;
  expiresAt: string;
}

export interface WithdrawCurrentGameResponse {
  participantId: string;
  status: 'WITHDRAWN';
  gameStatus: CurrentGameStatus;
  readyCount: number;
  schemaVersion: string;
}

async function gameGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return arenaApiRequest<T>(path, { signal });
}

function invalidProjection(code: string): never {
  throw new ArenaApiError(502, code);
}

export function decodePawnhouseGameState(value: unknown): PawnhouseGameState {
  const record = normalizeProjectionRecord(value);
  if (!record) return invalidProjection('invalid_game_projection');
  const gameId = String(projectionValue(record, 'gameId') || '').trim();
  const phase = String(projectionValue(record, 'phase') || '').trim();
  const schemaVersion = String(
    projectionValue(record, 'schemaVersion', 'schema_version') || '',
  ).trim();
  if (!gameId || !phase || !schemaVersion) {
    return invalidProjection('invalid_game_projection');
  }

  const normalized: PawnhouseGameState = {
    ...record,
    gameId,
    phase,
    schemaVersion,
    participants: normalizeProjectionArray(record.participants),
    pools: normalizeProjectionArray(record.pools),
    pairings: normalizeProjectionArray(record.pairings),
    negotiations: normalizeProjectionArray(record.negotiations),
    settlements: normalizeProjectionArray(record.settlements),
    rankings: normalizeProjectionArray(record.rankings),
    rounds: normalizeProjectionArray(record.rounds),
    priceSnapshots: normalizeProjectionArray(
      projectionValue(
        record,
        'priceSnapshots',
        'price_snapshots',
        'priceHistory',
        'price_history',
        'marketPriceHistory',
        'market_price_history',
        'roundPrices',
        'round_prices',
      ),
    ),
    liveRankings: normalizeProjectionArray(
      projectionValue(record, 'liveRankings', 'live_rankings'),
    ),
  };
  return normalized;
}

export function decodePawnhouseTimelineEvent(
  value: unknown,
): PawnhouseTimelineEvent {
  const record = normalizeProjectionRecord(value);
  if (!record) return invalidProjection('invalid_timeline_projection');
  const sequence = Number(record.sequence);
  const type = typeof record.type === 'string' ? record.type.trim() : '';
  const data = normalizeProjectionRecord(record.data);
  if (!Number.isFinite(sequence) || sequence < 0 || !type || !data) {
    return invalidProjection('invalid_timeline_projection');
  }
  return {
    sequence,
    type,
    data,
    roundId:
      typeof projectionValue(record, 'roundId', 'round_id') === 'string'
        ? String(projectionValue(record, 'roundId', 'round_id'))
        : null,
    occurredAt:
      typeof projectionValue(record, 'occurredAt', 'occurred_at') === 'string'
        ? String(projectionValue(record, 'occurredAt', 'occurred_at'))
        : undefined,
    createdAt:
      typeof projectionValue(record, 'createdAt', 'created_at') === 'string'
        ? String(projectionValue(record, 'createdAt', 'created_at'))
        : undefined,
  };
}

export function decodePawnhouseTimeline(value: unknown): PawnhouseTimeline {
  const record = normalizeProjectionRecord(value);
  if (!record) return invalidProjection('invalid_timeline_projection');
  const gameId = String(projectionValue(record, 'gameId') || '').trim();
  const schemaVersion = String(
    projectionValue(record, 'schemaVersion', 'schema_version') || '',
  ).trim();
  const nextAfter = Number(
    projectionValue(record, 'nextAfter', 'next_after') || 0,
  );
  if (
    !gameId
    || !schemaVersion
    || !Array.isArray(record.events)
    || !Number.isFinite(nextAfter)
  ) {
    return invalidProjection('invalid_timeline_projection');
  }
  return {
    gameId,
    schemaVersion,
    nextAfter,
    events: record.events.map(decodePawnhouseTimelineEvent),
  };
}

export function getCurrentGame(
  signal?: AbortSignal,
): Promise<CurrentGameResponse> {
  return gameGet<CurrentGameResponse>('/api/v1/games/current', signal);
}

export function getPawnhouseGame(
  gameId: string,
  signal?: AbortSignal,
): Promise<PawnhouseGameState> {
  return gameGet<unknown>(
    `/api/v1/pawnhouse/games/${encodeURIComponent(gameId)}`,
    signal,
  ).then(decodePawnhouseGameState);
}

export function getPawnhouseTimeline(
  gameId: string,
  after = 0,
  signal?: AbortSignal,
): Promise<PawnhouseTimeline> {
  const query = new URLSearchParams({ after: String(after) });
  return gameGet<unknown>(
    `/api/v1/pawnhouse/games/${encodeURIComponent(gameId)}/timeline?${query}`,
    signal,
  ).then(decodePawnhouseTimeline);
}

export function getPawnhouseEventsUrl(gameId: string, after = 0): string {
  const query = new URLSearchParams({ after: String(Math.max(0, after)) });
  return `${API_BASE_URL}/api/v1/pawnhouse/games/${encodeURIComponent(
    gameId,
  )}/events?${query}`;
}

export async function getGameParticipations(): Promise<GameParticipation[]> {
  const response = await arenaApiRequest<GameParticipationList>(
    '/api/game-participations?scope=mine',
  );
  return response.participations || [];
}

async function idempotentMutation<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  return arenaApiRequest<T>(
    path,
    {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(body),
    },
    { csrf: true },
  );
}

export async function getJoinPreflight(
  gameId: string,
  agentId: string,
  idempotencyKey: string,
): Promise<JoinPreflight> {
  return arenaApiRequest<JoinPreflight>(
    `/api/v1/games/${encodeURIComponent(gameId)}/join-preflight`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ agentId }),
    },
    { csrf: true },
  );
}

export async function joinCurrentGame(
  gameId: string,
  payload: JoinCurrentGamePayload,
  idempotencyKey: string,
): Promise<JoinCurrentGameResponse> {
  const path = `/api/v1/games/${encodeURIComponent(gameId)}/participants`;
  return arenaApiRequest<JoinCurrentGameResponse>(
    path,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    },
    { csrf: true },
  );
}

export function getArenaWallet(signal?: AbortSignal): Promise<{ wallet: ArenaWallet }> {
  return gameGet<{ wallet: ArenaWallet }>('/api/v1/me/wallet', signal);
}

export function getPaymentMandate(
  gameId: string,
  signal?: AbortSignal,
): Promise<{ mandate: PaymentMandate | null }> {
  return gameGet<{ mandate: PaymentMandate | null }>(
    `/api/v1/me/payment-mandates/${encodeURIComponent(gameId)}`,
    signal,
  );
}

export async function createPaymentMandate(
  payload: CreatePaymentMandatePayload,
  idempotencyKey: string,
): Promise<{ mandate: PaymentMandate }> {
  return arenaApiRequest<{ mandate: PaymentMandate }>(
    '/api/v1/me/payment-mandates',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    },
    { csrf: true },
  );
}

export async function revokeCurrentGameMandate(
  mandateId: string,
): Promise<PaymentMandate> {
  const value = await idempotentMutation<{ mandate: PaymentMandate }>(
    `/api/v1/me/payment-mandates/${encodeURIComponent(mandateId)}/revoke`,
    {},
    `revoke:${mandateId}`.slice(0, 128),
  );
  return value.mandate;
}

export async function withdrawCurrentGameParticipant(
  gameId: string,
  participantId: string,
  idempotencyKey: string,
): Promise<WithdrawCurrentGameResponse> {
  return arenaApiRequest<WithdrawCurrentGameResponse>(
    `/api/v1/games/${encodeURIComponent(gameId)}/participants/${encodeURIComponent(participantId)}`,
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    { csrf: true },
  );
}
