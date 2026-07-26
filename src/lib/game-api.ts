import { API_BASE_URL, arenaApiRequest } from '@/lib/platform-api';
import type { InitialPortfolio } from '@/lib/initial-loadout';

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
  schemaVersion: string;
  [key: string]: unknown;
}

export interface PawnhouseTimelineEvent {
  sequence: number;
  type: string;
  data: Record<string, unknown>;
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
  preflight: Pick<JoinPreflight, 'eligible' | 'readyToJoin' | 'safeErrorCode'>,
): boolean {
  return (
    preflight.eligible === true
    && preflight.readyToJoin === true
    && preflight.safeErrorCode === null
  );
}

export interface JoinCurrentGamePayload {
  agentId: string;
  joinAuthorizationId: string;
  paymentMandateId: string;
  portfolio: InitialPortfolio;
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

export function getCurrentGame(
  signal?: AbortSignal,
): Promise<CurrentGameResponse> {
  return gameGet<CurrentGameResponse>('/api/v1/games/current', signal);
}

export function getPawnhouseGame(
  gameId: string,
  signal?: AbortSignal,
): Promise<PawnhouseGameState> {
  return gameGet<PawnhouseGameState>(
    `/api/v1/pawnhouse/games/${encodeURIComponent(gameId)}`,
    signal,
  );
}

export function getPawnhouseTimeline(
  gameId: string,
  after = 0,
  signal?: AbortSignal,
): Promise<PawnhouseTimeline> {
  const query = new URLSearchParams({ after: String(after) });
  return gameGet<PawnhouseTimeline>(
    `/api/v1/pawnhouse/games/${encodeURIComponent(gameId)}/timeline?${query}`,
    signal,
  );
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

function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const prefix = 'adx_csrf=';
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

function mutationHeaders(idempotencyKey: string): Record<string, string> {
  const csrfToken = readCsrfCookie();
  return {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  };
}

async function idempotentMutation<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const csrfToken = readCsrfCookie();
  return arenaApiRequest<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function getJoinPreflight(
  gameId: string,
  agentId: string,
  idempotencyKey: string,
): Promise<JoinPreflight> {
  return arenaApiRequest<JoinPreflight>(
    `/api/v1/games/${encodeURIComponent(gameId)}/join-preflight`,
    {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify({ agentId }),
    },
  );
}

export function preflightCurrentGame(
  gameId: string,
  agentId: string,
  idempotencyKey: string,
): Promise<JoinPreflight> {
  return idempotentMutation<JoinPreflight>(
    `/api/v1/games/${encodeURIComponent(gameId)}/join-preflight`,
    { agentId },
    idempotencyKey,
  );
}

export function joinCurrentGame(
  gameId: string,
  payload: JoinCurrentGamePayload,
  idempotencyKey: string,
): Promise<JoinCurrentGameResponse>;
export function joinCurrentGame(
  gameId: string,
  agentId: string,
  joinAuthorizationId: string,
  paymentMandateId: string,
): Promise<JoinCurrentGameResponse>;
export function joinCurrentGame(
  gameId: string,
  payloadOrAgentId: JoinCurrentGamePayload | string,
  idempotencyKeyOrAuthorization: string,
  paymentMandateId?: string,
): Promise<JoinCurrentGameResponse> {
  const path = `/api/v1/games/${encodeURIComponent(gameId)}/participants`;
  if (typeof payloadOrAgentId === 'string') {
    return idempotentMutation<JoinCurrentGameResponse>(
      path,
      {
        agentId: payloadOrAgentId,
        joinAuthorizationId: idempotencyKeyOrAuthorization,
        paymentMandateId: paymentMandateId || '',
      },
    );
  }
  return arenaApiRequest<JoinCurrentGameResponse>(path, {
    method: 'POST',
    headers: mutationHeaders(idempotencyKeyOrAuthorization),
    body: JSON.stringify(payloadOrAgentId),
  });
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

export async function getActivePaymentMandate(
  gameId: string,
): Promise<PaymentMandate | null> {
  const value = await getPaymentMandate(gameId);
  return value.mandate;
}

export function createPaymentMandate(
  payload: CreatePaymentMandatePayload,
  idempotencyKey: string,
): Promise<{ mandate: PaymentMandate }> {
  return arenaApiRequest<{ mandate: PaymentMandate }>(
    '/api/v1/me/payment-mandates',
    {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    },
  );
}

export async function createCurrentGameMandate(
  gameId: string,
  preflight: JoinPreflight,
  mandateId: string,
): Promise<PaymentMandate> {
  const value = await idempotentMutation<{ mandate: PaymentMandate }>(
    '/api/v1/me/payment-mandates',
    {
      mandateId,
      gameId,
      chainId: preflight.mandateRequirements.chainId,
      tokenAddress: preflight.mandateRequirements.tokenAddress,
      maxPerPaymentAtomic: preflight.mandateRequirements.maxPerPaymentAtomic,
      maxCumulativeAtomic: preflight.mandateRequirements.maxCumulativeAtomic,
      allowedPayees: [],
      allowedPayeeRule: preflight.mandateRequirements.allowedPayeeRule,
      joinAuthorizationId: preflight.joinAuthorizationId,
      validFrom: new Date(Date.now() - 5_000).toISOString(),
      expiresAt: preflight.mandateRequirements.expiresAt,
    },
  );
  return value.mandate;
}

export async function revokeCurrentGameMandate(
  mandateId: string,
): Promise<PaymentMandate> {
  const value = await idempotentMutation<{ mandate: PaymentMandate }>(
    `/api/v1/me/payment-mandates/${encodeURIComponent(mandateId)}/revoke`,
    {},
  );
  return value.mandate;
}

export function withdrawCurrentGameParticipant(
  gameId: string,
  participantId: string,
  idempotencyKey: string,
): Promise<WithdrawCurrentGameResponse> {
  return arenaApiRequest<WithdrawCurrentGameResponse>(
    `/api/v1/games/${encodeURIComponent(gameId)}/participants/${encodeURIComponent(participantId)}`,
    {
      method: 'DELETE',
      headers: mutationHeaders(idempotencyKey),
    },
  );
}
