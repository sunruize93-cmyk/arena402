'use client';

import { useMemo } from 'react';
import {
  BroadcastGood,
  buildBroadcastGoods,
} from '@/lib/broadcast-model';
import { MarketCandleChart } from '@/components/MarketIntelligence';
import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

type RecordValue = Record<string, unknown>;

function gold(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return (value / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qualityLabel(good: BroadcastGood): string {
  if (good.dataQuality === 'authoritative') return 'COMMITTED OHLC';
  if (good.dataQuality === 'final_settlement') return 'FINAL SETTLEMENT';
  return 'AWAITING ARENA SNAPSHOT';
}

export default function MarketHistoryBoard({
  state,
  events,
}: {
  state: PawnhouseGameState | null;
  events: PawnhouseTimelineEvent[];
}) {
  const goods = useMemo(
    () =>
      buildBroadcastGoods(
        (state || {}) as RecordValue,
        events as unknown as RecordValue[],
      ),
    [events, state],
  );

  if (goods.length === 0) return null;

  const committedRounds = Math.max(
    0,
    ...goods.map((good) => good.candles.length),
  );

  return (
    <section
      className="gm-market-history-board"
      aria-labelledby="market-history-title"
    >
      <header className="gm-market-history-head">
        <div>
          <p className="label">Market chronicle · Four goods</p>
          <h2 className="display" id="market-history-title">
            Every market, round by round.
          </h2>
        </div>
        <div className="gm-market-history-summary">
          <strong>{String(committedRounds).padStart(2, '0')}</strong>
          <span>COMMITTED ROUNDS</span>
          <p>
            Arena-owned OHLC only. Public events never fabricate a price.
          </p>
        </div>
      </header>

      <div
        className="gm-market-history-grid"
        role="list"
        aria-label="Four-good round price history"
      >
        {goods.map((good) => {
          const latest = good.candles.at(-1);
          const direction =
            good.changePercent === null
              ? 'is-awaiting'
              : good.changePercent >= 0
                ? 'is-rising'
                : 'is-falling';

          return (
            <article
              className={`gm-market-history-card ${direction}`}
              key={good.goodId}
              role="listitem"
            >
              <div className="gm-market-history-card-head">
                <div>
                  <span className="gm-price-mark">{good.mark}</span>
                  <span>
                    <small>{qualityLabel(good)}</small>
                    <strong>{good.name}</strong>
                  </span>
                </div>
                <div>
                  <strong>
                    {gold(good.currentAtomic)} <small>GOLD</small>
                  </strong>
                  <span>
                    {good.changePercent === null
                      ? 'PRICE PENDING'
                      : `${good.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(
                          good.changePercent,
                        ).toFixed(2)}%`}
                  </span>
                </div>
              </div>

              <MarketCandleChart good={good} />

              <footer className="gm-market-history-card-foot">
                <span>
                  {latest
                    ? `R${String(latest.round).padStart(2, '0')} · O ${gold(
                        latest.open,
                      )} · H ${gold(latest.high)} · L ${gold(
                        latest.low,
                      )} · C ${gold(latest.close)}`
                    : 'Waiting for the first committed round'}
                </span>
                <span>
                  {latest?.committedTradeCount ?? 0} COMMITTED TRADES
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
