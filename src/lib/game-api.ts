import { arenaApiRequest } from '@/lib/platform-api';

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

interface GameParticipationList {
  participations: GameParticipation[];
  total: number;
}

async function gameGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return arenaApiRequest<T>(path, { signal });
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

export function joinPawnhouseGame(
  gameId: string,
  agentId: string,
  idempotencyKey: string,
): Promise<GameParticipation> {
  const csrfToken = readCsrfCookie();
  return arenaApiRequest<GameParticipation>(
    `/api/games/${encodeURIComponent(gameId)}/participants`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({ agentId }),
    },
  );
}
