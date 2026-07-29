import {
  ArenaHttpError,
  arenaHttpRequest,
} from '@/lib/arena-http';

export interface MyWallet {
  walletId: string;
  address: string;
  chainId: number;
  custodyMode: string;
  boundAt: string;
}

export interface WalletOverview {
  address: string;
  chainId: number;
  network: string;
  native: {
    symbol: string;
    balance: string;
  };
  tokens: Array<{
    symbol: string;
    contract: string;
    balance: string;
  }>;
  checkedAt: string;
}

export interface ExternalWallet {
  address: string;
  chainId: number;
  network: string;
  verifiedAt: string;
}

export interface WalletChallenge {
  challengeId: string;
  address: string;
  chainId: number;
  network: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export class WalletApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'WalletApiError';
  }
}

async function walletRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase();
  try {
    return await arenaHttpRequest<T>(path, init, {
      csrf: !['GET', 'HEAD', 'OPTIONS'].includes(method),
    });
  } catch (error) {
    if (error instanceof ArenaHttpError) {
      throw new WalletApiError(error.message, error.status, error.code);
    }
    throw error;
  }
}

// The Arena treasury custodies every player wallet. GET /api/v1/me/wallet
// lazily claims one available inventory wallet for the GitHub subject on the
// first authenticated call; the browser only reads the result, never binds.
// Errors arrive as string detail codes: wallet_pool_exhausted (409),
// github_identity_required / github_identity_conflict / wallet_binding_conflict (403).
export async function getMyWallet(): Promise<MyWallet> {
  const payload = await walletRequest<{ wallet?: MyWallet }>('/api/v1/me/wallet');
  const wallet = payload?.wallet;
  if (!wallet || typeof wallet.address !== 'string' || !wallet.address) {
    throw new WalletApiError('wallet_payload_invalid', 200, 'wallet_payload_invalid');
  }
  return wallet;
}

// Performs the same lazy allocation, then reads balances over Injective EVM
// JSON-RPC. Returns 503 { code: "wallet_overview_unavailable" } when the
// chain reader is not configured; the assignment above still stands.
export function getWalletOverview(): Promise<WalletOverview> {
  return walletRequest<WalletOverview>('/api/v1/me/wallet/overview');
}

export function getExternalWallet(): Promise<ExternalWallet> {
  return walletRequest<ExternalWallet>('/api/wallet');
}

export function createExternalWalletChallenge(
  address: string,
  chainId: number,
): Promise<WalletChallenge> {
  return walletRequest<WalletChallenge>('/api/wallet/challenge', {
    method: 'POST',
    body: JSON.stringify({ address, chainId }),
  });
}

export async function verifyExternalWallet(input: {
  challengeId: string;
  address: string;
  message: string;
  signature: string;
}): Promise<ExternalWallet> {
  const payload = await walletRequest<{ wallet: ExternalWallet }>('/api/wallet/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.wallet;
}

export function disconnectExternalWallet(): Promise<void> {
  return walletRequest<void>('/api/wallet', { method: 'DELETE' });
}
