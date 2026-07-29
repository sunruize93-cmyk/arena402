export const ARENA_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || ''
).replace(/\/$/, '');

export interface ArenaAuthUser {
  user_id: string;
  username: string;
  temporary: boolean;
  auth_provider: 'github' | 'password' | string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface ArenaAuthSession {
  user: ArenaAuthUser;
  csrf_token: string;
}

export class ArenaHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'ArenaHttpError';
  }
}

export interface ArenaHttpOptions {
  csrf?: boolean;
}

const NETWORK_RETRY_DELAY_MS = 250;
const SESSION_CACHE_TTL_MS = 30_000;

let cachedSession: ArenaAuthSession | null | undefined;
let cachedSessionAt = 0;
let sessionRequest: Promise<ArenaAuthSession | null> | null = null;
const sessionListeners = new Set<(session: ArenaAuthSession | null) => void>();

function notifySession(session: ArenaAuthSession | null) {
  for (const listener of sessionListeners) listener(session);
}

export function setArenaAuthSession(session: ArenaAuthSession | null) {
  cachedSession = session;
  cachedSessionAt = Date.now();
  notifySession(session);
}

export function invalidateArenaAuthSession() {
  cachedSession = undefined;
  cachedSessionAt = 0;
}

export function subscribeArenaAuthSession(
  listener: (session: ArenaAuthSession | null) => void,
): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorCode(body: unknown, status: number): string {
  if (!isRecord(body)) return `http_${status}`;
  const detail = body.detail;
  if (typeof detail === 'string') return detail;
  if (isRecord(detail) && typeof detail.code === 'string') return detail.code;
  if (typeof body.code === 'string') return body.code;
  if (typeof body.message === 'string') return body.message;
  return `http_${status}`;
}

function errorMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.message === 'string') return body.message;
  return fallback;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function waitForRetry(signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) throw new ArenaHttpError(0, 'request_aborted');
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new ArenaHttpError(0, 'request_aborted'));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, NETWORK_RETRY_DELAY_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchArenaSession(): Promise<ArenaAuthSession | null> {
  let response: Response;
  try {
    response = await fetch(`${ARENA_API_BASE_URL}/api/auth/session`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ArenaHttpError(0, 'network_unavailable');
  }

  if (response.status === 401) {
    setArenaAuthSession(null);
    return null;
  }
  if (!response.ok) {
    const body = await responseBody(response);
    const code = errorCode(body, response.status);
    throw new ArenaHttpError(
      response.status,
      code,
      errorMessage(body, code),
    );
  }

  const session = (await response.json()) as ArenaAuthSession;
  setArenaAuthSession(session);
  return session;
}

export function getArenaAuthSession(options?: {
  force?: boolean;
}): Promise<ArenaAuthSession | null> {
  const fresh =
    cachedSession !== undefined
    && Date.now() - cachedSessionAt < SESSION_CACHE_TTL_MS;
  if (!options?.force && fresh) {
    return Promise.resolve(cachedSession ?? null);
  }
  if (sessionRequest) return sessionRequest;

  sessionRequest = fetchArenaSession().finally(() => {
    sessionRequest = null;
  });
  return sessionRequest;
}

export async function getArenaCsrfToken(force = false): Promise<string> {
  const session = await getArenaAuthSession({ force });
  if (!session?.csrf_token) {
    throw new ArenaHttpError(401, 'authentication_required');
  }
  return session.csrf_token;
}

function canRetry(init: RequestInit | undefined, headers: Headers): boolean {
  const method = (init?.method || 'GET').toUpperCase();
  return (
    ['GET', 'HEAD', 'OPTIONS'].includes(method)
    || headers.has('Idempotency-Key')
  );
}

function sessionError(status: number, code: string): boolean {
  return (
    status === 401
    || code === 'authentication_required'
    || code === 'csrf_required'
    || code === 'csrf_session_unavailable'
  );
}

export async function arenaHttpRequest<T>(
  path: string,
  init?: RequestInit,
  options?: ArenaHttpOptions,
): Promise<T> {
  const baseHeaders = new Headers(init?.headers);
  if (!baseHeaders.has('Accept')) baseHeaders.set('Accept', 'application/json');
  if (init?.body && !baseHeaders.has('Content-Type')) {
    baseHeaders.set('Content-Type', 'application/json');
  }

  const retryable = canRetry(init, baseHeaders);
  let networkRetryAvailable = retryable;
  let csrfRetryAvailable = Boolean(options?.csrf && retryable);

  while (true) {
    const headers = new Headers(baseHeaders);
    if (options?.csrf && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', await getArenaCsrfToken());
    }

    let response: Response;
    try {
      response = await fetch(`${ARENA_API_BASE_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers,
      });
    } catch {
      if (init?.signal?.aborted) {
        throw new ArenaHttpError(0, 'request_aborted');
      }
      if (!networkRetryAvailable) {
        throw new ArenaHttpError(0, 'network_unavailable');
      }
      networkRetryAvailable = false;
      await waitForRetry(init?.signal);
      continue;
    }

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    const body = await responseBody(response);
    const code = errorCode(body, response.status);
    if (sessionError(response.status, code)) {
      if (response.status === 401) setArenaAuthSession(null);
      else invalidateArenaAuthSession();
    }

    if (
      response.status === 403
      && code === 'csrf_required'
      && csrfRetryAvailable
    ) {
      csrfRetryAvailable = false;
      baseHeaders.delete('X-CSRF-Token');
      await getArenaCsrfToken(true);
      continue;
    }

    throw new ArenaHttpError(
      response.status,
      code,
      errorMessage(body, code),
    );
  }
}
