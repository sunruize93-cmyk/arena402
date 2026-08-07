'use client';

import { useMemo, useState } from 'react';
import {
  BroadcastGood,
  buildBroadcastGoods,
} from '@/lib/broadcast-model';
import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

type RecordValue = Record<string, unknown>;

function gold(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const normalized = value / 1_000_000;
  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qualityLabel(good: BroadcastGood): string {
  if (good.dataQuality === 'event_reference') return 'EVENT REFERENCE';
  if (good.dataQuality === 'authoritative_ohlc') return 'COMMITTED OHLC';
  if (good.dataQuality === 'final_settlement') return 'FINAL SETTLEMENT';
  return 'AWAITING AUTHORITY';
}

function PriceSignal({ good }: { good: BroadcastGood }) {
  const closes = good.candles.slice(-6).map((candle) => candle.close);
  const direction =
    good.changePercent === null
      ? 'is-listening'
      : good.changePercent >= 0
        ? 'is-up'
        : 'is-down';
  const pulseKey = `${good.goodId}-${good.currentAtomic ?? 'pending'}`;

  if (closes.length < 2) {
    return (
      <span className={`gm-price-signal ${direction}`} aria-hidden="true">
        <span className="gm-price-listening">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="gm-price-commit-pulse" key={pulseKey} />
      </span>
    );
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(max - min, 1);
  const points = closes
    .map((value, index) => {
      const x = (index / (closes.length - 1)) * 72;
      const y = 19 - ((value - min) / span) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <span className={`gm-price-signal ${direction}`} aria-hidden="true">
      <svg viewBox="0 0 72 22" preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      <span className="gm-price-commit-pulse" key={pulseKey} />
    </span>
  );
}

export function MarketCandleChart({ good }: { good: BroadcastGood }) {
  const candles = good.candles.slice(-8);
  if (candles.length === 0) {
    return (
      <div className="gm-price-chart-empty">
        <strong>Reference price pending</strong>
        <span>The Arena has not published this round’s event-driven reference price.</span>
      </div>
    );
  }

  const values = candles.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, max * 0.08, 1);
  const width = 560;
  const height = 184;
  const top = 18;
  const bottom = 30;
  const plotHeight = height - top - bottom;
  const step = (width - 48) / candles.length;
  const y = (value: number) => top + ((max - value) / span) * plotHeight;
  const points = candles
    .map((candle, index) => {
      const x = 38 + index * step + step / 2;
      return `${x},${y(candle.close)}`;
    })
    .join(' ');

  return (
    <svg
      className="gm-price-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${good.name} event reference price by round`}
    >
      {[0, 0.5, 1].map((ratio) => (
        <line
          className="gm-price-chart-gridline"
          key={ratio}
          x1="24"
          x2={width - 12}
          y1={top + ratio * plotHeight}
          y2={top + ratio * plotHeight}
        />
      ))}
      <polyline className="gm-reference-line" points={points} />
      {candles.map((candle, index) => {
        const x = 38 + index * step + step / 2;
        return (
          <g key={`${good.goodId}-${candle.round}`}>
            <circle
              className="gm-reference-dot"
              cx={x}
              cy={y(candle.close)}
              r="5"
            />
            <text className="gm-price-round" x={x} y={height - 8}>
              R{candle.round}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function MarketIntelligence({
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
  const [selectedGoodId, setSelectedGoodId] = useState(goods[0]?.goodId || 'grain');
  const selected = goods.find((good) => good.goodId === selectedGoodId) || goods[0];

  if (!selected) return null;

  const quality = qualityLabel(selected);
  const latestCandle = selected.candles.at(-1);
  const eventMarker = latestCandle
    ? [...events].reverse().find((event) => {
        const round = Number(
          event.data.round
          ?? event.data.roundIndex
          ?? event.data.round_index,
        );
        return event.type === 'world.event_revealed' && round === latestCandle.round;
      })
    : undefined;
  const eventName = String(
    eventMarker?.data.eventId
    ?? eventMarker?.data.event_id
    ?? 'No public event marker',
  )
    .replaceAll('-', ' ')
    .slice(0, 48);

  return (
    <section className="gm-market-intelligence" aria-labelledby="market-price-title">
      <div className="gm-panel-head">
        <p className="label" id="market-price-title">Market intelligence</p>
        <p>Event reference prices · committed trades shown separately</p>
      </div>
      <div className="gm-price-grid-cards" role="list" aria-label="Official prices">
        {goods.map((good) => (
          <button
            type="button"
            className={`gm-price-card ${
              good.goodId === selected.goodId ? 'is-selected' : ''
            } ${
              good.changePercent === null
                ? 'is-awaiting'
                : good.changePercent >= 0
                  ? 'is-rising'
                  : 'is-falling'
            }`}
            key={good.goodId}
            onClick={() => setSelectedGoodId(good.goodId)}
            aria-pressed={good.goodId === selected.goodId}
          >
            <span className="gm-price-mark">{good.mark}</span>
            <strong>{good.name}</strong>
            <b>{gold(good.currentAtomic)} <small>GOLD</small></b>
            <em className={
              good.changePercent === null
                ? ''
                : good.changePercent >= 0 ? 'is-up' : 'is-down'
            }>
              {good.changePercent === null
                ? 'PRICE PENDING'
                : `${good.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(good.changePercent).toFixed(2)}%`}
            </em>
            <small className="gm-price-card-meta">
              VOL {good.latestVolume ?? '—'} · {qualityLabel(good)}
            </small>
            <PriceSignal good={good} />
          </button>
        ))}
      </div>
      <div className="gm-price-chart-head">
        <div>
          <p className="label">{selected.mark} · {quality}</p>
          <h3 className="display">{selected.name} price record</h3>
        </div>
        <div>
          <strong>{gold(selected.currentAtomic)} <small>GOLD</small></strong>
          <span>
            {selected.dataQuality === 'final_settlement'
              ? 'FINAL SETTLEMENT'
              : selected.dataQuality === 'authoritative_ohlc'
                ? 'COMMITTED OHLC'
                : 'EVENT REFERENCE'}
          </span>
        </div>
      </div>
      {latestCandle && (
        <div className="gm-price-authority">
          <dl aria-label={`${selected.name} latest public price facts`}>
            {[
              ['Reference', gold(latestCandle.close)],
              ['Prior reference', gold(selected.previousAtomic)],
              [
                'Change',
                selected.changePercent === null
                  ? '—'
                  : `${selected.changePercent >= 0 ? '+' : ''}${selected.changePercent.toFixed(2)}%`,
              ],
              ['Last clearing', gold(selected.lastClearingAtomic)],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <div>
            <span>R{latestCandle.round} · {eventName.toUpperCase()}</span>
            <span>
              {latestCandle.committedTradeCount ?? '—'} COMMITTED TRADES
            </span>
            <span>
              REFERENCE PRICE ≠ TRADE PRICE
            </span>
          </div>
        </div>
      )}
      <MarketCandleChart good={selected} />
    </section>
  );
}
