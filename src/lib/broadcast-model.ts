export const BROADCAST_GOODS = [
  {
    goodId: 'grain',
    name: 'Grain',
    mark: 'GR',
  },
  {
    goodId: 'iron',
    name: 'Iron',
    mark: 'FE',
  },
  {
    goodId: 'warhorse',
    name: 'Warhorse',
    mark: 'WH',
  },
  {
    goodId: 'gems',
    name: 'Gems',
    mark: 'GM',
  },
] as const;

export type BroadcastGoodId = (typeof BROADCAST_GOODS)[number]['goodId'];
export type BroadcastDataQuality =
  | 'authoritative'
  | 'final_settlement'
  | 'awaiting_authority';

type RecordValue = Record<string, unknown>;

export interface BroadcastCandle {
  round: number;
  open: number;
  high: number;
  low: number;
  close: number;
  lastClearing: number | null;
  committedTradeCount: number | null;
  carriedForward: boolean;
}

export interface BroadcastGood {
  goodId: BroadcastGoodId;
  name: string;
  mark: string;
  currentAtomic: number | null;
  previousAtomic: number | null;
  changePercent: number | null;
  lastClearingAtomic: number | null;
  latestVolume: number | null;
  candles: BroadcastCandle[];
  dataQuality: BroadcastDataQuality;
}

export interface BroadcastRankingRow {
  rank: number | null;
  previousRank: number | null;
  name: string;
  value: number | null;
  tier: string;
}

export interface BroadcastRankings {
  kind: 'live_net_worth' | 'final_net_worth' | 'awaiting_authority';
  rows: BroadcastRankingRow[];
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function pick(record: RecordValue | null, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nameFromId(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value
    .trim()
    .replace(/^agent[_:-]?/i, '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, 30);
}

function historyRows(state: RecordValue): RecordValue[] {
  const value =
    state.priceSnapshots ||
    state.priceHistory ||
    state.marketPriceHistory ||
    state.roundPrices;
  return Array.isArray(value)
    ? value.map(asRecord).filter((row): row is RecordValue => Boolean(row))
    : [];
}

function authoritativeCandles(
  state: RecordValue,
  goodId: BroadcastGoodId,
): BroadcastCandle[] {
  let previousClose: number | null = null;
  return historyRows(state)
    .filter(
      (row) =>
        String(pick(row, 'goodId', 'good_id', 'good')).toLowerCase() === goodId,
    )
    .sort(
      (left, right) =>
        Number(pick(left, 'round', 'roundIndex', 'round_index') || 0) -
        Number(pick(right, 'round', 'roundIndex', 'round_index') || 0),
    )
    .map((row, index): BroadcastCandle | null => {
      const round =
        numeric(pick(row, 'round', 'roundIndex', 'round_index')) || index + 1;
      const close =
        numeric(
          pick(
            row,
            'closeAtomic',
            'close_atomic',
            'marketPriceAtomic',
            'market_price_atomic',
            'priceAtomic',
            'price_atomic',
          ),
        ) ?? previousClose;
      if (close === null) return null;
      const open =
        numeric(pick(row, 'openAtomic', 'open_atomic')) ??
        previousClose ??
        close;
      const high =
        numeric(pick(row, 'highAtomic', 'high_atomic')) ??
        Math.max(open, close);
      const low =
        numeric(pick(row, 'lowAtomic', 'low_atomic')) ??
        Math.min(open, close);
      const count = numeric(
        pick(row, 'committedTradeCount', 'committed_trade_count', 'tradeCount'),
      );
      const lastClearing = numeric(
        pick(row, 'lastClearingAtomic', 'last_clearing_atomic'),
      );
      const candle = {
        round,
        open,
        high,
        low,
        close,
        lastClearing,
        committedTradeCount: count,
        carriedForward:
          Boolean(pick(row, 'carriedForward', 'carried_forward')) ||
          (count === 0 && open === close),
      };
      previousClose = close;
      return candle;
    })
    .filter((candle): candle is BroadcastCandle => candle !== null);
}

export function buildBroadcastGoods(
  rawState: RecordValue,
  _rawEvents: RecordValue[],
): BroadcastGood[] {
  const state = rawState || {};
  return BROADCAST_GOODS.map((definition) => {
    const authorityCandles = authoritativeCandles(
      state,
      definition.goodId,
    );
    const hasAuthority = authorityCandles.length > 0;
    const candles = [...authorityCandles];
    const finalPriceRecord = asRecord(state.finalPrices);
    const finalPrice = numeric(finalPriceRecord?.[definition.goodId]);
    const completed = String(state.phase || '').toLowerCase() === 'completed';
    if (completed && finalPrice !== null) {
      const finalRound = numeric(state.currentRound) || 0;
      const last = candles.at(-1);
      if (last && last.round === finalRound) {
        last.close = finalPrice;
        last.high = Math.max(last.high, last.open, finalPrice);
        last.low = Math.min(last.low, last.open, finalPrice);
        last.carriedForward = last.open === finalPrice;
      } else {
        const open = last?.close ?? finalPrice;
        candles.push({
          round: finalRound,
          open,
          high: Math.max(open, finalPrice),
          low: Math.min(open, finalPrice),
          close: finalPrice,
          lastClearing: null,
          committedTradeCount: null,
          carriedForward: open === finalPrice,
        });
      }
    }
    const currentAtomic = candles.at(-1)?.close ?? null;
    const previousAtomic =
      candles.at(-2)?.close ?? candles.at(-1)?.open ?? null;
    return {
      ...definition,
      currentAtomic,
      previousAtomic,
      changePercent:
        previousAtomic === null ||
        currentAtomic === null ||
        previousAtomic === 0
          ? null
          : ((currentAtomic - previousAtomic) / previousAtomic) * 100,
      lastClearingAtomic: candles.at(-1)?.lastClearing ?? null,
      latestVolume: candles.at(-1)?.committedTradeCount ?? null,
      candles,
      dataQuality: hasAuthority
        ? 'authoritative'
        : completed && finalPrice !== null
          ? 'final_settlement'
          : 'awaiting_authority',
    };
  });
}

export function buildBroadcastRankings(
  rawState: RecordValue,
): BroadcastRankings {
  const live = Array.isArray(rawState.liveRankings)
    ? rawState.liveRankings
    : Array.isArray(rawState.live_rankings)
      ? rawState.live_rankings
      : null;
  const final = Array.isArray(rawState.rankings) ? rawState.rankings : null;
  const source = live || final;
  if (source && source.length > 0) {
    const rows = source
      .map(asRecord)
      .filter((row): row is RecordValue => Boolean(row))
      .map((row, index) => ({
        rank: numeric(pick(row, 'rank')) || index + 1,
        previousRank: numeric(pick(row, 'previousRank', 'previous_rank')),
        name: nameFromId(
          pick(row, 'displayName', 'display_name', 'agentId', 'agent_id'),
          `Agent ${String(index + 1).padStart(2, '0')}`,
        ),
        value: numeric(
          pick(row, 'netWorthAtomic', 'net_worth_atomic', 'elo'),
        ),
        tier:
          typeof pick(row, 'tier') === 'string'
            ? String(pick(row, 'tier')).slice(0, 40)
            : '',
      }))
      .sort((left, right) => (left.rank || 99) - (right.rank || 99));
    return {
      kind: live ? 'live_net_worth' : 'final_net_worth',
      rows,
    };
  }

  const participants = Array.isArray(rawState.participants)
    ? rawState.participants
    : [];
  return {
    kind: 'awaiting_authority',
    rows: participants
      .map(asRecord)
      .filter((row): row is RecordValue => Boolean(row))
      .map((row, index) => ({
        rank: null,
        previousRank: null,
        name: nameFromId(
          pick(row, 'displayName', 'display_name', 'agentId', 'agent_id'),
          `Agent ${String(index + 1).padStart(2, '0')}`,
        ),
        value: null,
        tier: 'SEAT CONFIRMED',
      })),
  };
}
