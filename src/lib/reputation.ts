import type { AgentReputation } from '@/lib/game-api';

type RecordValue = Record<string, unknown>;

function pick(record: RecordValue, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function count(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function formatSuccessRate(
  value: number | null | undefined,
  tradeAttempts?: number,
): string {
  if (
    tradeAttempts === 0
    || value === null
    || value === undefined
    || !Number.isSafeInteger(value)
    || value < 0
    || value > 10_000
  ) {
    return '—';
  }
  return `${(value / 100).toFixed(2)}%`;
}

export function readAgentReputation(
  source: unknown,
): AgentReputation | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as RecordValue;
  const nested =
    record.reputation && typeof record.reputation === 'object'
      ? (record.reputation as RecordValue)
      : record;
  const tradeAttempts = count(
    pick(nested, 'tradeAttempts', 'trade_attempts'),
  );
  const settledTrades = count(
    pick(nested, 'settledTrades', 'settled_trades'),
  );
  const failedNegotiations = count(
    pick(nested, 'failedNegotiations', 'failed_negotiations'),
  );
  const rawRate = pick(nested, 'successRateBps', 'success_rate_bps');
  const successRateBps = rawRate === null ? null : count(rawRate);

  if (
    tradeAttempts === null
    || settledTrades === null
    || failedNegotiations === null
    || (successRateBps !== null && successRateBps > 10_000)
  ) {
    return null;
  }

  return {
    tradeAttempts,
    settledTrades,
    successRateBps,
    failedNegotiations,
  };
}
