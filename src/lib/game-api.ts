import { arenaApiRequest } from '@/lib/platform-api';
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

export interface CurrentGameParticipant {
  participantId: string;
  agentId: string;
  displayName: string;
  runtimeKind: string;
  readiness: 'PENDING' | 'READY' | 'WITHDRAWN';
  joinedAt: string;
  reputation?: AgentReputation;
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

export interface AgentReputation {
  tradeAttempts: number;
  settledTrades: number;
  successRateBps: number | null;
  failedNegotiations: number;
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
  schemaVersion: string;
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
  walletId: string;
  chainId: number;
  tokenAddress: string;
  maxPerPaymentAtomic: string;
  maxCumulativeAtomic: string;
  reservedAtomic: string;
  consumedAtomic: string;
  allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT' | null;
  joinAuthorizationId: string | null;
  validFrom: string;
  expiresAt: string;
  revokedAt: string | null;
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

export function joinCurrentGame(
  gameId: string,
  payload: JoinCurrentGamePayload,
  idempotencyKey: string,
): Promise<JoinCurrentGameResponse> {
  return arenaApiRequest<JoinCurrentGameResponse>(
    `/api/v1/games/${encodeURIComponent(gameId)}/participants`,
    {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    },
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
