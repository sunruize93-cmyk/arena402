'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DEMO_ROUNDS } from '@/lib/game-demo';
import {
  getCurrentGame,
  getPawnhouseTimeline,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';
import {
  buildLedgerStats,
  buildLedgerTrades,
  explorerTokenUrl,
  explorerTxUrl,
  formatGold,
  LEDGER_CHAIN_FACTS,
  LEDGER_CONTRACTS,
  LEDGER_STAGES,
  LedgerTrade,
  shortHash,
} from '@/lib/ledger-model';

const GOODS: Record<string, { label: string; nature: string }> = {
  grain: { label: 'Grain', nature: 'The staple' },
  iron: { label: 'Iron', nature: 'The cycle' },
  warhorse: { label: 'Warhorse', nature: 'The scarce' },
  gems: { label: 'Gems', nature: 'The gamble' },
};

const FILTERS = ['all', 'grain', 'iron', 'warhorse', 'gems'] as const;

const DEMO_LEDGER_EVENTS = DEMO_ROUNDS.flatMap((round) => round.events);

const STATUS_LABELS: Record<LedgerTrade['status'], string> = {
  pending: 'Settling',
  confirmed: 'Sealed',
  committed: 'Sealed',
  failed: 'No deal',
};

function confirmedTimeLabel(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function TradeRow({
  trade,
  simulated,
  gameId,
}: {
  trade: LedgerTrade;
  simulated: boolean;
  gameId: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const good = GOODS[trade.goodId] || { label: trade.goodId || 'Goods', nature: '' };
  const sealed = trade.status === 'confirmed' || trade.status === 'committed';
  const verifyUrl = simulated ? null : explorerTxUrl(trade.txHash);
  const settledAtomic =
    trade.amountAtomic ??
    (trade.priceAtomic !== null ? trade.priceAtomic * trade.quantity : null);

  async function copyHash() {
    if (!trade.txHash || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(trade.txHash);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article
      className={`ledger-row ${open ? 'is-open' : ''} ${
        trade.status === 'failed' ? 'is-failed' : ''
      }`}
    >
      <button
        type="button"
        className="ledger-row-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ledger-cell-round">
          {trade.round !== null ? `R${String(trade.round).padStart(2, '0')}` : '—'}
        </span>
        <span className="ledger-cell-good">
          {good.label}
          <small>{good.nature}</small>
        </span>
        <span className="ledger-cell-parties">
          <b>{trade.buyer}</b>
          <span>→</span>
          <b>{trade.seller}</b>
        </span>
        <span className="ledger-cell-price">
          {formatGold(settledAtomic)} GOLD
          <small>QTY {trade.quantity}</small>
        </span>
        <span className="ledger-cell-tx">
          {trade.txHash ? shortHash(trade.txHash) : 'AWAITING TX'}
          <small>
            {simulated
              ? 'Simulated · not on-chain'
              : trade.verifiable
                ? `Confirmed ${confirmedTimeLabel(trade.confirmedAt)}`
                : sealed
                  ? 'Proof pending'
                  : STATUS_LABELS[trade.status]}
          </small>
        </span>
        <span
          className={`ledger-status ${
            sealed ? 'is-sealed' : trade.status === 'failed' ? 'is-failed' : ''
          }`}
        >
          {STATUS_LABELS[trade.status]}
        </span>
      </button>

      {open && (
        <div className="ledger-row-detail">
          <div>
            <p className="label">Settlement rite · {trade.pairingId}</p>
            <ul className="ledger-stage-list">
              {LEDGER_STAGES.map((stage, index) => (
                <li
                  key={stage.id}
                  className={index <= trade.stageReached ? 'is-done' : ''}
                >
                  <span className="ledger-stage-mark" aria-hidden="true">
                    {index <= trade.stageReached ? '✓' : ''}
                  </span>
                  {stage.label}
                </li>
              ))}
            </ul>
          </div>
          <aside className="ledger-detail-aside">
            <p className="label">Chain receipt</p>
            {trade.txHash ? (
              <p>
                TX {trade.txHash}{' '}
                <button
                  type="button"
                  className="wallet-copy-action"
                  onClick={() => void copyHash()}
                >
                  {copied ? (
                    <Check size={12} aria-hidden="true" />
                  ) : (
                    <Copy size={12} aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </p>
            ) : (
              <p>The feed has not carried a transaction hash for this trade.</p>
            )}
            {verifyUrl ? (
              <a
                className="ledger-verify-btn"
                href={verifyUrl}
                target="_blank"
                rel="noreferrer"
              >
                Verify on chain <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ) : (
              <span className="ledger-verify-pending">
                {simulated ? 'Simulated · not on-chain' : 'Proof pending'}
              </span>
            )}
            <p className="ledger-detail-watch">
              <Link className="wallet-text-link" href={`/game/${gameId}`}>
                Watch this table <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </p>
          </aside>
        </div>
      )}
    </article>
  );
}

export default function ImperialLedger({ requestedGameId }: { requestedGameId?: string }) {
  const [gameId, setGameId] = useState('');
  const [liveEvents, setLiveEvents] = useState<PawnhouseTimelineEvent[]>([]);
  const [feedError, setFeedError] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  // The table is resolved on the client only, so the server frame stays free
  // of locale-formatted times and never mismatches on hydration. An explicit
  // ?game wins; otherwise follow the current public table and fall back to
  // the scripted demo when the Arena API has nothing to show.
  useEffect(() => {
    if (requestedGameId) {
      setGameId(requestedGameId);
      return;
    }
    let cancelled = false;
    getCurrentGame()
      .then((response) => {
        if (!cancelled && response.game.status !== 'WAITING') {
          setGameId(response.game.gameId);
        } else if (!cancelled) {
          setGameId('demo');
        }
      })
      .catch(() => {
        if (!cancelled) setGameId('demo');
      });
    return () => {
      cancelled = true;
    };
  }, [requestedGameId]);

  const simulated = gameId === 'demo';

  useEffect(() => {
    if (!gameId || simulated) return;
    let after = 0;
    let stopped = false;
    // A fresh table starts from a clean slate; sequences from another game
    // would collide with the de-duplication below.
    setLiveEvents([]);
    setFeedError(false);

    async function refresh(signal?: AbortSignal) {
      try {
        const timeline = await getPawnhouseTimeline(gameId, after, signal);
        if (stopped) return;
        if (timeline.events.length > 0) {
          after = timeline.nextAfter;
          setLiveEvents((current) => {
            const merged = [...current, ...timeline.events];
            return merged.filter(
              (event, index, rows) =>
                rows.findIndex(
                  (candidate) => candidate.sequence === event.sequence,
                ) === index,
            );
          });
        }
        setFeedError(false);
      } catch (cause) {
        if (!stopped && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setFeedError(true);
        }
      }
    }

    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [gameId, simulated]);

  const events = simulated ? DEMO_LEDGER_EVENTS : liveEvents;
  const trades = useMemo(() => buildLedgerTrades(events), [events]);
  const stats = useMemo(() => buildLedgerStats(trades), [trades]);
  const visibleTrades =
    filter === 'all' ? trades : trades.filter((trade) => trade.goodId === filter);

  return (
    <div className="ledger-page site-main">
      <section className="ledger-hero">
        <Link className="back-btn" href="/">
          ← The Arena gate
        </Link>
        <p className="label">The Ledger · Every trade on a public chain</p>
        <h1 className="display ledger-title">The Ledger Remembers.</h1>
        <p className="ledger-lede">
          Every sealed bargain in the Pawnhouse settles through x402 on Injective
          EVM testnet. Each row below is one trade, one transaction hash, one
          receipt anyone on the chain can verify.
        </p>
        <p className="ledger-epigraph">
          “The empire forgets every name, but the ledger remembers every trade.”
        </p>
        <div
          className={`ledger-feed-line ${!simulated && !feedError ? 'is-live' : ''}`}
        >
          <span className="ledger-feed-dot" aria-hidden="true" />
          <span>
            {!gameId
              ? 'Locating the current table…'
              : simulated
                ? 'Scripted demonstration feed'
                : feedError
                  ? 'Public feed unreachable · showing last known entries'
                  : `Public live feed · game ${gameId}`}
          </span>
          {simulated && <span className="ledger-sim-badge">Simulated · not on-chain</span>}
        </div>
      </section>

      <dl className="ledger-chain-strip" aria-label="Chain facts">
        {LEDGER_CHAIN_FACTS.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {LEDGER_CONTRACTS.map((contract) => (
          <div key={contract.symbol}>
            <dt>{contract.name}</dt>
            <dd>
              <a href={explorerTokenUrl(contract.address)} target="_blank" rel="noreferrer">
                {shortHash(contract.address)}
              </a>
              <small>{contract.role}</small>
            </dd>
          </div>
        ))}
      </dl>

      <div className="ledger-stats" aria-label="Ledger totals">
        <div>
          <strong>{stats.sealedCount}</strong>
          <span>Trades sealed</span>
        </div>
        <div>
          <strong>{formatGold(stats.settledAtomic)}</strong>
          <span>Gold settled</span>
        </div>
        <div>
          <strong>{stats.failedCount}</strong>
          <span>Bargains collapsed</span>
        </div>
        <div>
          <strong>{confirmedTimeLabel(stats.lastConfirmedAt)}</strong>
          <span>Last chain seal</span>
        </div>
      </div>

      <section className="ledger-body" aria-labelledby="ledger-entries-title">
        <div className="ledger-body-heading">
          <div>
            <p className="label">The entries</p>
            <h2 className="display" id="ledger-entries-title">
              Line by line.
            </h2>
          </div>
          <div className="ledger-filters" role="group" aria-label="Filter by goods">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`ledger-filter ${filter === item ? 'is-active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {item === 'all' ? 'All goods' : GOODS[item]?.label || item}
              </button>
            ))}
          </div>
        </div>

        {visibleTrades.length > 0 ? (
          <div className="ledger-rows">
            {visibleTrades.map((trade) => (
              <TradeRow
                key={trade.pairingId}
                trade={trade}
                simulated={simulated}
                gameId={gameId || 'demo'}
              />
            ))}
          </div>
        ) : (
          <div className="ledger-empty">
            <p>No settlements recorded on this table yet.</p>
            <span>Sealed trades appear here after chain confirmation.</span>
          </div>
        )}
      </section>
    </div>
  );
}
