import { API_BASE_URL, arenaApiRequest } from '@/lib/platform-api';
import { getConnectorCsrfToken } from '@/lib/connector-api';

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
  readiness: 'PENDING' | 'READY';
  joinedAt: string;
  isOfficial: boolean;
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

async function idempotentMutation<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const csrfToken = await getConnectorCsrfToken();
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

export interface JoinPreflight {
  gameId: string;
  agentId: string;
  joinAuthorizationId: string;
  checks: Record<string, string>;
  mandateRequirements: {
    chainId: number;
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    maxPerPaymentAtomic: string;
    maxCumulativeAtomic: string;
    allowedPayeeRule: 'SAME_GAME_SETTLEMENT_ACCOUNT';
    expiresAt: string;
  };
  portfolioRequirements: {
    initialNetWorthAtomic: string;
    goldDecimals: number;
    allowedGoods: string[];
    defaultPortfolio: {
      cashAtomic: string;
      holdings: Record<string, number>;
    };
  };
}

export interface PaymentMandate {
  mandateId: string;
  gameId: string;
  joinAuthorizationId: string | null;
  expiresAt: string;
}

export interface JoinCurrentGameResponse {
  gameId: string;
  participantId: string;
  readiness: 'READY';
  status: CurrentGameStatus;
  readyCount: number;
  startThreshold: number;
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

export function getPawnhouseEventsUrl(
  gameId: string,
  after = 0,
): string {
  const query = new URLSearchParams({ after: String(Math.max(0, after)) });
  return `${API_BASE_URL}/api/v1/pawnhouse/games/${encodeURIComponent(
    gameId,
  )}/events?${query}`;
}

export async function getActivePaymentMandate(
  gameId: string,
): Promise<PaymentMandate | null> {
  const value = await gameGet<{ mandate: PaymentMandate | null }>(
    `/api/v1/me/payment-mandates/${encodeURIComponent(gameId)}`,
  );
  return value.mandate;
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
      maxPerPaymentAtomic:
        preflight.mandateRequirements.maxPerPaymentAtomic,
      maxCumulativeAtomic:
        preflight.mandateRequirements.maxCumulativeAtomic,
      allowedPayees: [],
      allowedPayeeRule:
        preflight.mandateRequirements.allowedPayeeRule,
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

export function joinCurrentGame(
  gameId: string,
  agentId: string,
  joinAuthorizationId: string,
  paymentMandateId: string,
): Promise<JoinCurrentGameResponse> {
  return idempotentMutation<JoinCurrentGameResponse>(
    `/api/v1/games/${encodeURIComponent(gameId)}/participants`,
    {
      agentId,
      joinAuthorizationId,
      paymentMandateId,
    },
  );
}
