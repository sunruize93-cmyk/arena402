export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || ''
).replace(/\/$/, '');

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

const NETWORK_RETRY_DELAY_MS = 250;

function canRetry(init: RequestInit | undefined, headers: Headers): boolean {
  const method = (init?.method || 'GET').toUpperCase();
  return (
    ['GET', 'HEAD', 'OPTIONS'].includes(method)
    || headers.has('Idempotency-Key')
  );
}

async function waitForRetry(signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) throw new ArenaApiError(0, 'request_aborted');
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new ArenaApiError(0, 'request_aborted'));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, NETWORK_RETRY_DELAY_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function errorCode(body: unknown, status: number): string {
  if (!body || typeof body !== 'object') return `http_${status}`;
  const detail = Reflect.get(body, 'detail');
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const code = Reflect.get(detail, 'code');
    if (typeof code === 'string') return code;
  }
  return `http_${status}`;
}

export async function arenaApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const attempts = canRetry(init, headers) ? 2 : 1;
  let response: Response | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers,
      });
      break;
    } catch {
      if (init?.signal?.aborted) {
        throw new ArenaApiError(0, 'request_aborted');
      }
      if (attempt + 1 >= attempts) {
        throw new ArenaApiError(0, 'network_unavailable');
      }
      await waitForRetry(init?.signal);
    }
  }

  if (!response) throw new ArenaApiError(0, 'network_unavailable');
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw new ArenaApiError(response.status, errorCode(body, response.status));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getArenaHealth(signal?: AbortSignal): Promise<ArenaHealth> {
  return arenaApiRequest<ArenaHealth>('/api/health', { signal });
}
