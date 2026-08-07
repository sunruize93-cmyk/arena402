'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  advanceDemoPlayback,
  buildDemoGameState,
  DEMO_INITIAL_EVENT_COUNT,
  DEMO_ROUNDS,
} from '@/lib/game-demo';
import type { DemoPlaybackPosition } from '@/lib/game-demo';
import { PawnhouseTimelineEvent } from '@/lib/game-api';
import {
  BroadcastGood,
  buildBroadcastGoods,
  buildBroadcastRankings,
} from '@/lib/broadcast-model';
import {
  startLiveGameFeed,
} from '@/lib/live-game-feed';
import type { LiveGameFeedSnapshot } from '@/lib/live-game-feed';
import {
  projectionValue as pick,
  publicAgentName,
} from '@/lib/public-projection';
import type { ProjectionRecord as RecordValue } from '@/lib/public-projection';

const WORLD_EVENT_NAMES: Record<string, string> = {
  'palace-requisition': 'Palace requisition',
  'new-iron-mine': 'A new iron mine',
  'granary-fire': 'The granary fire',
  'noble-gem-fever': 'Noble gem fever',
  'coronation-cancelled': 'The coronation falls',
  'barbarian-siege': 'The city under siege',
  'peace-rumor': 'Rumors of peace',
  'merchant-caravan': 'The southern caravan',
  'royal-wedding': 'A royal wedding',
  'stable-plague': 'Plague in the stables',
};

const EMPTY_TIMELINE_EVENTS: PawnhouseTimelineEvent[] = [];

function agentName(value: unknown, fallback = 'An Agent'): string {
  return publicAgentName(value, fallback, 120);
}

function gold(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const amount = Math.abs(value) >= 100_000 ? value / 1_000_000 : value;
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function eventHeadline(event: PawnhouseTimelineEvent): string {
  const data = event.data || {};
  if (event.type === 'world.event_revealed') {
    const eventId = String(pick(data, 'eventId', 'event_id') || '');
    return String(
      pick(data, 'displayName', 'display_name') ||
        WORLD_EVENT_NAMES[eventId] ||
        'A new royal bulletin',
    );
  }
  if (event.type === 'decision.applied') {
    return `${agentName(pick(data, 'agentId', 'agent_id'))} · ${String(
      pick(data, 'action') || 'ORDER',
    ).toUpperCase()} ${String(pick(data, 'goodId', 'good_id', 'good') || '')}`;
  }
  if (event.type === 'pairing.created') {
    return `${agentName(
      pick(data, 'buyerAgentId', 'buyer_agent_id'),
      'Buyer',
    )} meets ${agentName(
      pick(data, 'sellerAgentId', 'seller_agent_id'),
      'Seller',
    )} · ${String(pick(data, 'goodId', 'good_id', 'good') || 'goods').toUpperCase()}`;
  }
  if (event.type === 'negotiation.message') {
    const price = Number(
      pick(data, 'priceAtomic', 'price_atomic', 'price') || Number.NaN,
    );
    return `${agentName(
      pick(data, 'actorAgentId', 'actor_agent_id', 'agentId', 'agent_id'),
    )} · ${String(pick(data, 'action') || 'RESPONSE').toUpperCase()}${
      Number.isFinite(price) ? ` ${gold(price)} GOLD` : ''
    }`;
  }
  if (event.type === 'settlement.inventory_committed') return 'Trade committed to the Arena ledger';
  if (event.type === 'settlement.chain_confirmed') return 'Payment confirmed on-chain';
  if (event.type === 'round.closed') return 'Round ledger sealed';
  return event.type.replaceAll('.', ' ').replaceAll('_', ' ');
}

function currentRoundEvents(
  events: PawnhouseTimelineEvent[],
  currentRound: number,
): PawnhouseTimelineEvent[] {
  const starts = events.filter(
    (event) =>
      event.type === 'round.started' &&
      Number(pick(event.data, 'roundIndex', 'round_index', 'round')) ===
        currentRound,
  );
  const startSequence = starts.at(-1)?.sequence;
  if (startSequence === undefined) {
    return events.filter(
      (event) =>
        Number(pick(event.data, 'round', 'roundIndex', 'round_index')) ===
        currentRound,
    );
  }
  return events.filter((event) => event.sequence >= startSequence);
}

function phaseLabel(value: unknown): string {
  const phase = String(value || 'waiting').replaceAll('_', ' ');
  return phase.toUpperCase();
}

function CandleChart({
  good,
  eventRounds,
}: {
  good: BroadcastGood;
  eventRounds: number[];
}) {
  const candles = good.candles.slice(-10);
  if (candles.length === 0) {
    return (
      <div className="broadcast-chart-waiting">
        <span>PRICE AUTHORITY PENDING</span>
        <i />
      </div>
    );
  }
  const eventReference = good.dataQuality === 'event_reference';
  const values = eventReference
    ? candles.map((candle) => candle.close)
    : candles.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, max * 0.08, 1);
  const width = 620;
  const height = 190;
  const top = 18;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const step = (width - 54) / Math.max(candles.length, 1);
  const y = (value: number) => top + ((max - value) / span) * plotHeight;

  if (eventReference) {
    const points = candles
      .map((candle, index) => {
        const x = 44 + index * step + step / 2;
        return `${x},${y(candle.close)}`;
      })
      .join(' ');
    return (
      <svg
        className="broadcast-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${good.name} event reference price by round`}
      >
        {[0, 0.5, 1].map((ratio) => (
          <line
            className="broadcast-grid-line"
            key={ratio}
            x1="30"
            x2={width - 12}
            y1={top + ratio * plotHeight}
            y2={top + ratio * plotHeight}
          />
        ))}
        <polyline className="broadcast-reference-line" points={points} />
        {candles.map((candle, index) => {
          const x = 44 + index * step + step / 2;
          const marked = eventRounds.includes(candle.round);
          return (
            <g className={marked ? 'is-event' : ''} key={`${good.goodId}-${candle.round}`}>
              {marked && (
                <line
                  className="broadcast-event-pin"
                  x1={x}
                  x2={x}
                  y1={top}
                  y2={height - bottom + 5}
                />
              )}
              <circle className="broadcast-reference-dot" cx={x} cy={y(candle.close)} r="6" />
              <text className="broadcast-round-label" x={x} y={height - 9}>
                R{candle.round}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      className="broadcast-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${good.name} price candles by round`}
    >
      {[0, 0.5, 1].map((ratio) => (
        <line
          className="broadcast-grid-line"
          key={ratio}
          x1="30"
          x2={width - 12}
          y1={top + ratio * plotHeight}
          y2={top + ratio * plotHeight}
        />
      ))}
      {candles.map((candle, index) => {
        const x = 44 + index * step + step / 2;
        const openY = y(candle.open);
        const closeY = y(candle.close);
        const highY = y(candle.high);
        const lowY = y(candle.low);
        const up = candle.close >= candle.open;
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
        const marked = eventRounds.includes(candle.round);
        return (
          <g className={marked ? 'is-event' : ''} key={`${good.goodId}-${candle.round}`}>
            {marked && (
              <line
                className="broadcast-event-pin"
                x1={x}
                x2={x}
                y1={top}
                y2={height - bottom + 5}
              />
            )}
            <line
              className="broadcast-candle-wick"
              x1={x}
              x2={x}
              y1={highY}
              y2={lowY}
            />
            <rect
              className={`broadcast-candle-body ${up ? 'is-up' : 'is-down'}${
                candle.carriedForward ? ' is-flat' : ''
              }`}
              x={x - Math.min(11, step * 0.22)}
              y={bodyY}
              width={Math.min(22, step * 0.44)}
              height={bodyHeight}
            />
            <text className="broadcast-round-label" x={x} y={height - 9}>
              R{candle.round}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ExpoBroadcastBoard({ gameId }: { gameId: string }) {
  const demo = gameId === 'demo';
  const [liveFeed, setLiveFeed] = useState<LiveGameFeedSnapshot | null>(null);
  const [demoUpdatedAt, setDemoUpdatedAt] = useState(Date.now());
  const [clock, setClock] = useState(Date.now());
  const [demoPlayback, setDemoPlayback] = useState<DemoPlaybackPosition>({
    roundIndex: 0,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  });

  useEffect(() => {
    setLiveFeed(null);
    setDemoUpdatedAt(Date.now());
  }, [gameId]);

  useEffect(() => {
    document.body.classList.add('broadcast-active');
    return () => document.body.classList.remove('broadcast-active');
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!demo) return;
    const timer = window.setInterval(() => {
      setDemoPlayback((current) => advanceDemoPlayback(current));
      setDemoUpdatedAt(Date.now());
    }, 2_200);
    return () => window.clearInterval(timer);
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    return startLiveGameFeed({
      gameId,
      eventLimit: 600,
      onSnapshot: setLiveFeed,
    });
  }, [demo, gameId]);

  const demoRound = DEMO_ROUNDS[demoPlayback.roundIndex] || DEMO_ROUNDS[0];
  const demoEvents = demoRound.events.slice(0, demoPlayback.eventCount);
  const activeLiveFeed = liveFeed?.gameId === gameId ? liveFeed : null;
  const liveState = activeLiveFeed?.state || null;
  const liveEvents = activeLiveFeed?.events || EMPTY_TIMELINE_EVENTS;
  const lastUpdated = demo
    ? demoUpdatedAt
    : activeLiveFeed?.lastUpdatedAt || clock;
  const error =
    activeLiveFeed?.error || activeLiveFeed?.delayed ? 'FEED DELAYED' : '';
  const state = demo
    ? buildDemoGameState(demoRound, demoEvents)
    : liveState;
  const events = demo ? demoEvents : liveEvents;
  const round = Number(state?.currentRound || 0);
  const totalRounds = Number(state?.roundCount || state?.totalRounds || 0);
  const goods = useMemo(
    () =>
      buildBroadcastGoods(
        (state || {}) as RecordValue,
        events as unknown as RecordValue[],
      ),
    [events, state],
  );
  const rankings = useMemo(
    () => buildBroadcastRankings((state || {}) as RecordValue),
    [state],
  );
  const wireEvents = useMemo(
    () => currentRoundEvents(events, round).slice(-12),
    [events, round],
  );
  const eventRounds = useMemo(
    () =>
      events
        .filter((event) => event.type === 'world.event_revealed')
        .map((event) =>
          Number(pick(event.data, 'round', 'roundIndex', 'round_index')),
        )
        .filter(Number.isFinite),
    [events],
  );
  const lagSeconds = Math.max(0, Math.floor((clock - lastUpdated) / 1_000));
  const stale = Boolean(error) || (!demo && lagSeconds > 9);
  const latestSequence = events.at(-1)?.sequence || 0;
  const quality = goods.some((good) => good.dataQuality === 'event_reference')
    ? 'EVENT REFERENCE PRICES'
    : goods.some((good) => good.dataQuality === 'authoritative_ohlc')
      ? 'COMMITTED ROUND OHLC'
    : goods.some((good) => good.dataQuality === 'final_settlement')
      ? 'FINAL SETTLEMENT PRICES'
      : 'AWAITING PRICE AUTHORITY';

  const tickerItems =
    wireEvents.length > 0
      ? wireEvents
      : [
          {
            sequence: 0,
            type: 'broadcast.waiting',
            data: {},
          } satisfies PawnhouseTimelineEvent,
        ];

  return (
    <div className="broadcast-screen">
      <section
        className="broadcast-wire"
        id="event-wire"
        aria-label="Current round event wire"
      >
        <div className="broadcast-wire-label">
          <span>EVENT WIRE</span>
          <strong>ROUND {String(round).padStart(2, '0')}</strong>
        </div>
        <div className="broadcast-wire-window">
          <div className="broadcast-wire-track">
            {[...tickerItems, ...tickerItems].map((event, index) => (
              <span key={`${event.sequence}-${index}`}>
                <b>#{String(event.sequence).padStart(4, '0')}</b>
                {eventHeadline(event)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <header className="broadcast-status">
        <Link
          className="broadcast-back"
          href={demo ? '/' : `/game/${encodeURIComponent(gameId)}`}
          aria-label="Back to the previous Arena view"
        >
          ← BACK
        </Link>
        <div className="broadcast-brand">
          <span className="broadcast-brand-mark">A402</span>
          <span>
            <strong>ARENA 402</strong>
            <small>THE KING&apos;S PAWNHOUSE · LIVE MARKET</small>
          </span>
        </div>
        <div className="broadcast-round">
          <span>ROUND</span>
          <strong>{String(round).padStart(2, '0')}</strong>
          <i>/</i>
          <b>{String(totalRounds).padStart(2, '0')}</b>
        </div>
        <div className="broadcast-phase">
          <span>{phaseLabel(state?.phase)}</span>
          <strong className={stale ? 'is-stale' : ''}>
            <i />
            {stale ? `DELAYED · ${lagSeconds}s` : 'LIVE'}
          </strong>
        </div>
      </header>

      <main className="broadcast-main">
        <div className="broadcast-market">
          <section className="broadcast-price-strip" id="prices">
            {goods.map((good) => (
              <article className="broadcast-price-card" key={good.goodId}>
                <div>
                  <span className="broadcast-good-mark">{good.mark}</span>
                  <span>
                    <strong>{good.name}</strong>
                    <small>
                      ROUND {String(round).padStart(2, '0')}{' '}
                      {good.dataQuality === 'event_reference' ? 'REFERENCE' : 'CLOSE'}
                    </small>
                  </span>
                </div>
                <p>
                  {gold(good.currentAtomic)}
                  <small> GOLD</small>
                </p>
                <footer>
                  <span>
                    PREV {gold(good.previousAtomic)}
                  </span>
                  <b
                    className={
                      good.changePercent === null
                        ? ''
                        : good.changePercent >= 0
                          ? 'is-up'
                          : 'is-down'
                    }
                  >
                    {good.changePercent === null
                      ? 'PRICE PENDING'
                      : `${good.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(
                          good.changePercent,
                        ).toFixed(2)}%`}
                  </b>
                </footer>
              </article>
            ))}
          </section>

          <section className="broadcast-charts" id="market-history">
            {goods.map((good) => (
              <article className="broadcast-chart-card" key={good.goodId}>
                <header>
                  <span>
                    <b>{good.mark}</b>
                    <strong>{good.name}</strong>
                  </span>
                  <span>
                    <small>
                      {good.candles.length} ROUND
                      {good.candles.length === 1 ? '' : 'S'} ·{' '}
                      {good.dataQuality === 'event_reference' ? 'REFERENCE' : 'OHLC'}
                    </small>
                    <b>{gold(good.currentAtomic)}</b>
                  </span>
                </header>
                <CandleChart good={good} eventRounds={eventRounds} />
              </article>
            ))}
          </section>
        </div>

        <aside className="broadcast-ladder" id="ladder">
          <header>
            <span>LIVE LADDER</span>
            <strong>
              {rankings.kind === 'awaiting_authority'
                ? 'SEATS · RANK PENDING'
                : rankings.kind === 'final_net_worth'
                  ? 'FINAL NET WORTH'
                  : 'MARK-TO-MARKET'}
            </strong>
          </header>
          <div className="broadcast-ladder-rows">
            {rankings.rows.slice(0, 10).map((row, index) => {
              const movement =
                row.rank && row.previousRank
                  ? row.previousRank - row.rank
                  : 0;
              return (
                <article
                  className={row.rank === 1 ? 'is-leader' : ''}
                  key={`${row.name}-${index}`}
                >
                  <span className="broadcast-rank-number">
                    {row.rank ? String(row.rank).padStart(2, '0') : '··'}
                  </span>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.tier || 'ARENA AGENT'}</small>
                  </div>
                  <p>
                    <strong>{gold(row.value)}</strong>
                    <small>{row.value === null ? 'PENDING' : 'GOLD'}</small>
                  </p>
                  <span className="broadcast-rank-move">
                    {movement > 0 ? `▲${movement}` : movement < 0 ? `▼${Math.abs(movement)}` : '—'}
                  </span>
                </article>
              );
            })}
            {rankings.rows.length === 0 && (
              <p className="broadcast-empty">WAITING FOR SEALED SEATS</p>
            )}
          </div>
          <footer>
            <span>{rankings.rows.length} AGENTS</span>
            <span>AUTHORITY: ARENA API</span>
          </footer>
        </aside>
      </main>

      <footer className="broadcast-ledger-pulse">
        <span>
          <i />
          {quality}
        </span>
        <span>WORLD EVENTS MARKED ON EVERY PRICE PATH</span>
        <span>
          LAST SEQUENCE #{String(latestSequence).padStart(4, '0')} ·{' '}
          {new Date(lastUpdated).toLocaleTimeString('en-GB', { hour12: false })}
        </span>
      </footer>
    </div>
  );
}
