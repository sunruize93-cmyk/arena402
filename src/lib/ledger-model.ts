import type { PawnhouseTimelineEvent } from '@/lib/game-api';
import type { LedgerApiTrade } from '@/lib/ledger-api';

// Public chain facts. The explorer base stays overridable so the backend (or a
// mainnet switch) can supply the canonical URL without a frontend change.
export const LEDGER_EXPLORER_BASE = (
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  'https://testnet.blockscout.injective.network'
).replace(/\/$/, '');

export const LEDGER_CONTRACTS = [
  {
    symbol: '402-G',
    name: 'arena402-g',
    role: 'Game trading capital',
    address: '0xBF7B7268CE82d92BaC7a95a741F4003FE84e1884',
  },
  {
    symbol: '402-M',
    name: 'arena402-m',
    role: 'Soulbound participation mark',
    address: '0xE6b9865a5fbbb45bF58b8235D02Ec40d97D58E8d',
  },
] as const;

export const LEDGER_CHAIN_FACTS = [
  ['Network', 'Injective EVM testnet'],
  ['Chain ID', '1439'],
  ['Settlement', 'x402 · EIP-3009'],
  ['Explorer', 'Testnet Blockscout'],
] as const;

export type LedgerTradeStatus = 'pending' | 'confirmed' | 'committed' | 'failed';

// Settlement lifecycle in public event order.
export const LEDGER_STAGES = [
  { id: 'frozen', label: 'Terms frozen' },
  { id: 'approved', label: 'Payment authorized' },
  { id: 'submitted', label: 'x402 submitted' },
  { id: 'confirmed', label: 'Chain confirmed' },
  { id: 'committed', label: 'Inventory committed' },
] as const;

export interface LedgerTrade {
  pairingId: string;
  round: number | null;
  goodId: string;
  quantity: number;
  priceAtomic: number | null;
  amountAtomic: number | null;
  buyer: string;
  seller: string;
  txHash: string;
  status: LedgerTradeStatus;
  stageReached: number;
  sequence: number;
  confirmedAt: string | null;
  verifiable: boolean;
  // Chain-receipt fields carried only by the ledger API projection. The
  // timeline replay leaves them unset and the UI renders them as absent.
  tradeId?: string;
  gameId?: string;
  blockNumber?: string | null;
  buyerAddress?: string | null;
  sellerAddress?: string | null;
  facilitatorAddress?: string | null;
}

export interface LedgerStats {
  sealedCount: number;
  settledAtomic: number;
  failedCount: number;
  lastConfirmedAt: string | null;
}

function pick(data: unknown, ...keys: string[]): unknown {
  if (!data || typeof data !== 'object') return undefined;
  for (const key of keys) {
    const value = Reflect.get(data, key);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function cleanText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function asAtomic(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Only a full 32-byte hash earns a verify link. Demo fixtures and truncated
// placeholders must never look chain-verifiable.
export function isVerifiableTxHash(hash: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

export function explorerTxUrl(hash: string): string | null {
  return isVerifiableTxHash(hash) ? `${LEDGER_EXPLORER_BASE}/tx/${hash}` : null;
}

// The backend now delivers its canonical template
// (`https://…/tx/{txHash}`). It wins over the build-time base so a mainnet
// switch needs no frontend change; invalid hashes still never earn a link.
export function explorerTxUrlFromTemplate(
  template: string | null | undefined,
  hash: string,
): string | null {
  if (!isVerifiableTxHash(hash)) return null;
  if (template && template.split('{txHash}').length === 2) {
    return template.replace('{txHash}', hash);
  }
  return `${LEDGER_EXPLORER_BASE}/tx/${hash}`;
}

export function isAccountAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function explorerAddressUrlFromTemplate(
  template: string | null | undefined,
  address: string,
): string | null {
  if (!isAccountAddress(address)) return null;
  const marker = template ? template.indexOf('/tx/{txHash}') : -1;
  const base =
    template && marker > 0 ? template.slice(0, marker) : LEDGER_EXPLORER_BASE;
  return `${base}/address/${address}`;
}

export function explorerTokenUrl(address: string): string {
  return `${LEDGER_EXPLORER_BASE}/token/${address}`;
}

export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatGold(atomic: number | null): string {
  if (atomic === null || !Number.isFinite(atomic)) return '—';
  const gold = atomic / 1_000_000;
  return gold
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

export function displayAgent(value: unknown, fallback: string): string {
  const raw = cleanText(value, '');
  if (!raw) return fallback;
  const tail = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
  const trimmed = tail.length > 14 ? `${tail.slice(0, 12)}…` : tail;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

interface TradeDraft extends LedgerTrade {
  hasSettlement: boolean;
}

function draftFor(
  drafts: Map<string, TradeDraft>,
  pairingId: string,
  round: number | null,
  sequence: number,
): TradeDraft {
  let draft = drafts.get(pairingId);
  if (!draft) {
    draft = {
      pairingId,
      round,
      goodId: '',
      quantity: 1,
      priceAtomic: null,
      amountAtomic: null,
      buyer: 'Buyer',
      seller: 'Seller',
      txHash: '',
      status: 'pending',
      stageReached: -1,
      sequence,
      confirmedAt: null,
      verifiable: false,
      hasSettlement: false,
    };
    drafts.set(pairingId, draft);
  }
  return draft;
}

// Replays the public timeline into one row per pairing that reached the
// settlement stage. The frontend never invents financial facts: fields the
// feed does not carry stay empty and render as pending.
export function buildLedgerTrades(
  events: PawnhouseTimelineEvent[],
): LedgerTrade[] {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const drafts = new Map<string, TradeDraft>();
  let currentRound: number | null = null;

  for (const event of ordered) {
    const data = event.data || {};
    if (event.type === 'round.started') {
      const round = Number(pick(data, 'roundIndex', 'round_index', 'round'));
      currentRound = Number.isFinite(round) && round > 0 ? round : currentRound;
      continue;
    }

    const pairingId = cleanText(pick(data, 'pairingId', 'pairing_id'), '');
    if (!pairingId) continue;
    const draft = draftFor(drafts, pairingId, currentRound, event.sequence);
    draft.sequence = event.sequence;
    if (draft.round === null) draft.round = currentRound;

    if (event.type === 'pairing.created') {
      draft.goodId = cleanText(pick(data, 'goodId', 'good_id', 'good'), '');
      draft.buyer = displayAgent(
        pick(
          data,
          'buyerAgentId',
          'buyer_agent_id',
          'buyerParticipantId',
          'buyer_participant_id',
        ),
        'Buyer',
      );
      draft.seller = displayAgent(
        pick(
          data,
          'sellerAgentId',
          'seller_agent_id',
          'sellerParticipantId',
          'seller_participant_id',
        ),
        'Seller',
      );
    } else if (event.type === 'negotiation.message') {
      const price = asAtomic(pick(data, 'priceAtomic', 'price_atomic', 'price'));
      if (price !== null) draft.priceAtomic = price;
      const quantity = Number(pick(data, 'quantity'));
      if (Number.isFinite(quantity) && quantity > 0) draft.quantity = quantity;
    } else if (event.type === 'settlement.intent_frozen') {
      draft.hasSettlement = true;
      draft.stageReached = Math.max(draft.stageReached, 0);
      const amount = asAtomic(pick(data, 'amountAtomic', 'amount_atomic', 'amount'));
      if (amount !== null) draft.amountAtomic = amount;
    } else if (event.type === 'settlement.approved') {
      draft.hasSettlement = true;
      draft.stageReached = Math.max(draft.stageReached, 1);
    } else if (event.type === 'settlement.submitted') {
      draft.hasSettlement = true;
      draft.stageReached = Math.max(draft.stageReached, 2);
      draft.txHash = cleanText(
        pick(data, 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash'),
        draft.txHash,
      );
    } else if (event.type === 'settlement.chain_confirmed') {
      draft.hasSettlement = true;
      draft.stageReached = Math.max(draft.stageReached, 3);
      draft.status = 'confirmed';
      draft.txHash = cleanText(
        pick(data, 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash'),
        draft.txHash,
      );
      draft.confirmedAt = event.occurredAt || event.createdAt || null;
    } else if (event.type === 'settlement.inventory_committed') {
      draft.hasSettlement = true;
      draft.stageReached = Math.max(draft.stageReached, 4);
      if (draft.status !== 'failed') draft.status = 'committed';
    } else if (
      event.type === 'settlement.reverted' ||
      event.type === 'settlement.confirmation_timeout'
    ) {
      draft.hasSettlement = true;
      draft.status = 'failed';
    }
  }

  return [...drafts.values()]
    .filter((draft) => draft.hasSettlement)
    .map(({ hasSettlement: _settled, ...trade }) => ({
      ...trade,
      verifiable: isVerifiableTxHash(trade.txHash),
    }))
    .sort((a, b) => b.sequence - a.sequence);
}

export function buildLedgerStats(trades: LedgerTrade[]): LedgerStats {
  let sealedCount = 0;
  let settledAtomic = 0;
  let failedCount = 0;
  let lastConfirmedAt: string | null = null;

  for (const trade of trades) {
    if (trade.status === 'confirmed' || trade.status === 'committed') {
      sealedCount += 1;
      const amount =
        trade.amountAtomic ??
        (trade.priceAtomic !== null ? trade.priceAtomic * trade.quantity : 0);
      settledAtomic += amount;
      if (
        trade.confirmedAt &&
        (!lastConfirmedAt || trade.confirmedAt > lastConfirmedAt)
      ) {
        lastConfirmedAt = trade.confirmedAt;
      }
    } else if (trade.status === 'failed') {
      failedCount += 1;
    }
  }

  return { sealedCount, settledAtomic, failedCount, lastConfirmedAt };
}

// Authoritative settlement statuses (db/migrations/009) collapsed onto the
// four display states and the furthest completed lifecycle stage.
const API_STATUS_MAP: Record<
  string,
  { status: LedgerTradeStatus; stage: number }
> = {
  authorization_requested: { status: 'pending', stage: 0 },
  submitted: { status: 'pending', stage: 2 },
  chain_confirmed_uncommitted: { status: 'confirmed', stage: 3 },
  inventory_committed: { status: 'committed', stage: 4 },
  authorization_failed: { status: 'failed', stage: 0 },
  expired: { status: 'failed', stage: 0 },
  submission_failed: { status: 'failed', stage: 1 },
  confirmation_timeout: { status: 'failed', stage: 2 },
  reverted: { status: 'failed', stage: 2 },
};

// Maps one ledger-API row onto the shared display shape. Unknown statuses
// degrade to a pending row instead of guessing a chain outcome.
export function mapLedgerApiTrade(trade: LedgerApiTrade): LedgerTrade {
  const mapped = API_STATUS_MAP[trade.status] || {
    status: 'pending' as LedgerTradeStatus,
    stage: 0,
  };
  const txHash = cleanText(trade.txHash, '');
  const round = Number(trade.round);
  return {
    pairingId: cleanText(trade.pairingId, ''),
    tradeId: cleanText(trade.tradeId, ''),
    gameId: cleanText(trade.gameId, ''),
    round: Number.isFinite(round) && round > 0 ? round : null,
    goodId: cleanText(trade.goodId, ''),
    quantity:
      Number.isFinite(trade.quantity) && trade.quantity > 0
        ? trade.quantity
        : 1,
    priceAtomic: asAtomic(trade.priceAtomic),
    amountAtomic: asAtomic(trade.amountAtomic),
    buyer: displayAgent(
      trade.buyer?.displayName || trade.buyer?.agentId,
      'Buyer',
    ),
    seller: displayAgent(
      trade.seller?.displayName || trade.seller?.agentId,
      'Seller',
    ),
    buyerAddress: isAccountAddress(trade.buyer?.accountAddress)
      ? trade.buyer.accountAddress
      : null,
    sellerAddress: isAccountAddress(trade.seller?.accountAddress)
      ? trade.seller.accountAddress
      : null,
    facilitatorAddress: isAccountAddress(trade.facilitatorAddress)
      ? trade.facilitatorAddress
      : null,
    blockNumber: cleanText(trade.blockNumber, '') || null,
    txHash,
    status: mapped.status,
    stageReached: mapped.stage,
    sequence: 0,
    confirmedAt: cleanText(trade.chainConfirmedAt, '') || null,
    verifiable: isVerifiableTxHash(txHash),
  };
}

// Keeps the newest-first server order while replacing refreshed head rows and
// preserving already-paginated tail rows by tradeId.
export function mergeLedgerHead(
  head: LedgerTrade[],
  existing: LedgerTrade[],
): LedgerTrade[] {
  const headIds = new Set(head.map((trade) => trade.tradeId));
  return [
    ...head,
    ...existing.filter((trade) => !headIds.has(trade.tradeId)),
  ];
}
