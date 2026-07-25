import { arenaApiRequest } from '@/lib/platform-api';

// Client for the public read-only trade-ledger projection. Shapes mirror
// web/ledger_api.py (`arena402.trade-ledger-*.v1`) — the backend owns the
// financial semantics; this module only transports them.

export interface LedgerTradeParty {
  agentId: string;
  displayName: string;
  accountAddress: string;
}

export interface LedgerApiTrade {
  tradeId: string;
  gameId: string;
  round: number;
  goodId: string;
  quantity: number;
  priceAtomic: string;
  amountAtomic: string;
  buyer: LedgerTradeParty;
  seller: LedgerTradeParty;
  pairingId: string;
  chainId: number;
  txHash: string | null;
  blockNumber: string | null;
  chainConfirmedAt: string | null;
  facilitatorAddress: string | null;
  status: string;
  createdAt: string;
  schemaVersion: string;
}

export interface LedgerTradesResponse {
  trades: LedgerApiTrade[];
  nextAfter: string | null;
  chainId: number;
  explorerTxUrlTemplate: string;
  schemaVersion: string;
}

export interface LedgerStatsResponse {
  totalTrades: number;
  totalAmountAtomic: string;
  agentCount: number;
  chainId: number;
  explorerTxUrlTemplate: string;
  schemaVersion: string;
}

export interface LedgerTradesQuery {
  gameId?: string;
  agentId?: string;
  goodId?: string;
  after?: string;
  limit?: number;
}

export function getLedgerTrades(
  query: LedgerTradesQuery = {},
  signal?: AbortSignal,
): Promise<LedgerTradesResponse> {
  const params = new URLSearchParams();
  if (query.gameId) params.set('gameId', query.gameId);
  if (query.agentId) params.set('agentId', query.agentId);
  if (query.goodId) params.set('goodId', query.goodId);
  if (query.after) params.set('after', query.after);
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.toString();
  return arenaApiRequest<LedgerTradesResponse>(
    `/api/v1/ledger/trades${suffix ? `?${suffix}` : ''}`,
    { signal },
  );
}

export function getLedgerStats(
  signal?: AbortSignal,
): Promise<LedgerStatsResponse> {
  return arenaApiRequest<LedgerStatsResponse>('/api/v1/ledger/stats', {
    signal,
  });
}
