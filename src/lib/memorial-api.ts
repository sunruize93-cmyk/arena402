import { arenaApiRequest } from '@/lib/platform-api';

export interface MemorialStats {
  campaign: string;
  name: string;
  symbol: string;
  chainId: number;
  contractAddress: string | null;
  status: 'preparing' | 'active' | 'minting' | 'completed' | 'paused' | string;
  editionSize: number;
  reserved: number;
  submitted: number;
  minted: number;
  remaining: number;
}

export interface MemorialAward {
  eligible: true;
  campaign: string;
  registrationRank: number;
  editionSize: number;
  tokenId: number;
  walletId: string;
  walletAddress: string;
  eligibilityStatus: string;
  status: 'reserved' | 'submitted' | 'minted' | 'failed' | string;
  credentialStatus: 'unclaimed' | 'claimed' | string;
  contractAddress: string | null;
  transactionHash: string | null;
  mintBlockNumber: number | null;
  transactionUrl: string | null;
  tokenUrl: string | null;
  registeredAt: string;
  assignedAt: string | null;
  mintedAt: string | null;
}

export interface MemorialUnavailable {
  eligible: false;
  campaign: string;
  editionSize: number;
  reason:
    | 'github_identity_required'
    | 'campaign_preparing'
    | 'founding_edition_full'
    | 'registration_pending'
    | string;
}

export function getMemorialStats(signal?: AbortSignal): Promise<MemorialStats> {
  return arenaApiRequest<MemorialStats>('/api/v1/memorial/stats', { signal });
}

export function getMyMemorial(
  signal?: AbortSignal,
): Promise<MemorialAward | MemorialUnavailable> {
  return arenaApiRequest<MemorialAward | MemorialUnavailable>(
    '/api/v1/me/memorial',
    { signal },
  );
}
