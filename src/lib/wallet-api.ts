import { CONNECTOR_API_BASE_URL, getConnectorCsrfToken } from '@/lib/connector-api';

export interface WalletBinding {
  address: string;
  chainId: number;
  network: string;
  verifiedAt: string;
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

interface WalletErrorBody {
  detail?: string | { code?: string };
  message?: string;
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
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', await getConnectorCsrfToken());
  }

  let response: Response;
  try {
    response = await fetch(`${CONNECTOR_API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new WalletApiError('The Arena API is unreachable.', 0, 'network_unavailable');
  }

  if (!response.ok) {
    let body: WalletErrorBody = {};
    try {
      body = (await response.json()) as WalletErrorBody;
    } catch {
      // Keep the HTTP status as the fallback error.
    }
    const detail = body.detail;
    const code =
      typeof detail === 'string'
        ? detail
        : detail?.code || body.message || `http_${response.status}`;
    throw new WalletApiError(code, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// The Arena custodies every player wallet. The browser only reads the
// assignment and balances; it never signs, binds, or unbinds anything.
export function getWalletBinding(): Promise<WalletBinding> {
  return walletRequest<WalletBinding>('/api/wallet');
}

export function getWalletOverview(): Promise<WalletOverview> {
  return walletRequest<WalletOverview>('/api/wallet/overview');
}

