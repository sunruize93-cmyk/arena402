import {
  ARENA_API_BASE_URL,
  ArenaHttpError,
  ArenaHttpOptions,
  arenaHttpRequest,
} from '@/lib/arena-http';

export const API_BASE_URL = ARENA_API_BASE_URL;

export interface ArenaHealth {
  status: string;
  version: string;
  connector_gateway: 'production' | 'demo' | 'off' | string;
  hosted_agent_creation: boolean;
  arena_participation: boolean;
  pawnhouse: 'read_only' | 'development' | 'off' | string;
}

export class ArenaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'ArenaApiError';
  }
}

export async function arenaApiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: ArenaHttpOptions,
): Promise<T> {
  try {
    return await arenaHttpRequest<T>(path, init, options);
  } catch (error) {
    if (error instanceof ArenaHttpError) {
      throw new ArenaApiError(error.status, error.code);
    }
    throw error;
  }
}

export function getArenaHealth(signal?: AbortSignal): Promise<ArenaHealth> {
  return arenaApiRequest<ArenaHealth>('/api/health', { signal });
}
