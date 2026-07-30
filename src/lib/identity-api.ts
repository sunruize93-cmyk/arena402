import {
  arenaHttpRequest,
  getArenaAuthSession,
  getArenaCsrfToken,
  setArenaAuthSession,
} from '@/lib/arena-http';
import type { ArenaAuthSession } from '@/lib/arena-http';

export type ArenaIdentitySession = ArenaAuthSession;

export function getIdentitySession(
  force = false,
): Promise<ArenaIdentitySession | null> {
  return getArenaAuthSession({ force });
}

export function getIdentityCsrfToken(force = false): Promise<string> {
  return getArenaCsrfToken(force);
}

export async function acceptArenaInvite(input: {
  invite_code: string;
  username: string;
  password: string;
}): Promise<ArenaIdentitySession> {
  const session = await arenaHttpRequest<ArenaIdentitySession>(
    '/api/auth/invite',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  setArenaAuthSession(session);
  return session;
}

export async function registerArenaUser(input: {
  invite_code?: string;
  username: string;
  password: string;
}): Promise<ArenaIdentitySession> {
  const session = await arenaHttpRequest<ArenaIdentitySession>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  setArenaAuthSession(session);
  return session;
}

export async function loginArenaUser(input: {
  username: string;
  password: string;
}): Promise<ArenaIdentitySession> {
  const session = await arenaHttpRequest<ArenaIdentitySession>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  setArenaAuthSession(session);
  return session;
}

export async function logoutArenaUser(): Promise<void> {
  await arenaHttpRequest<void>(
    '/api/auth/logout',
    { method: 'POST' },
    { csrf: true },
  );
  setArenaAuthSession(null);
}
