'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_ROUNDS } from '@/lib/game-demo';
import { getCurrentGame } from '@/lib/game-api';
import {
  getLedgerStats,
  getLedgerTrades,
  LedgerStatsResponse,
} from '@/lib/ledger-api';
import {
  buildLedgerStats,
  buildLedgerTrades,
  explorerAddressUrlFromTemplate,
  explorerTokenUrl,
  explorerTxUrlFromTemplate,
  formatGold,
  LEDGER_CHAIN_FACTS,
  LEDGER_CONTRACTS,
  LEDGER_STAGES,
  LedgerTrade,
  mapLedgerApiTrade,
  mergeLedgerHead,
  shortHash,
} from '@/lib/ledger-model';
import { startLiveGameFeed } from '@/lib/live-game-feed';
import type { LiveGameFeedSnapshot } from '@/lib/live-game-feed';

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
  explorerTemplate,
  showGame,
}: {
  trade: LedgerTrade;
  simulated: boolean;
  gameId: string;
  explorerTemplate: string | null;
  showGame: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const good = GOODS[trade.goodId] || { label: trade.goodId || 'Goods', nature: '' };
  const sealed = trade.status === 'confirmed' || trade.status === 'committed';
  const verifyUrl = simulated
    ? null
    : explorerTxUrlFromTemplate(explorerTemplate, trade.txHash);
  const watchGameId = trade.gameId || gameId;
  const addressRows = (
    [
      ['Buyer account', trade.buyerAddress],
      ['Seller account', trade.sellerAddress],
      ['Facilitator', trade.facilitatorAddress],
    ] as Array<[string, string | null | undefined]>
  ).filter((row): row is [string, string] => Boolean(row[1]));
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
          {showGame && trade.gameId && (
            <small>
              {trade.gameId.length > 12
                ? `${trade.gameId.slice(0, 12)}…`
                : trade.gameId}
            </small>
          )}
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
            {(trade.blockNumber || trade.confirmedAt) && (
              <p>
                {trade.blockNumber ? `Block ${trade.blockNumber}` : 'Block pending'}
                {trade.confirmedAt
                  ? ` · sealed ${confirmedTimeLabel(trade.confirmedAt)}`
                  : ''}
              </p>
            )}
            {addressRows.length > 0 && (
              <ul className="ledger-addr-list">
                {addressRows.map(([label, address]) => {
                  const url = explorerAddressUrlFromTemplate(
                    explorerTemplate,
                    address,
                  );
                  return (
                    <li key={label}>
                      <span>{label}</span>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          {shortHash(address)}
                        </a>
                      ) : (
                        <span>{shortHash(address)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
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
              <Link className="wallet-text-link" href={`/game/${watchGameId || 'demo'}`}>
                Watch this table <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </p>
          </aside>
        </div>
      )}
    </article>
  );
}

type FeedSource = 'resolving' | 'ledger' | 'timeline' | 'demo';

const LEDGER_PAGE_SIZE = 25;

export default function ImperialLedger({
  requestedGameId,
  requestedAgentId,
}: {
  requestedGameId?: string;
  requestedAgentId?: string;
}) {
  const [source, setSource] = useState<FeedSource>('resolving');
  const [gameId, setGameId] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  // Ledger-API mode: authoritative cross-game rows straight from the
  // backend projection, newest first, cursor-paginated.
  const [apiTrades, setApiTrades] = useState<LedgerTrade[]>([]);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [explorerTemplate, setExplorerTemplate] = useState<string | null>(null);
  const [apiStats, setApiStats] = useState<LedgerStatsResponse | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pagedRef = useRef(false);

  // Timeline fallback mode: per-game public event replay.
  const [liveFeed, setLiveFeed] = useState<LiveGameFeedSnapshot | null>(null);
  const [feedError, setFeedError] = useState(false);

  // The table is resolved on the client only, so the server frame stays free
  // of locale-formatted times and never mismatches on hydration. The ledger
  // API is the preferred authority; a backend without it degrades to the
  // per-game timeline replay, and the scripted demo remains the last resort.
  useEffect(() => {
    if (requestedGameId === 'demo') {
      setGameId('demo');
      setSource('demo');
      return;
    }
    let cancelled = false;
    setSource('resolving');
    getLedgerTrades({
      gameId: requestedGameId,
      agentId: requestedAgentId,
      limit: 1,
    })
      .then(() => {
        if (cancelled) return;
        setGameId(requestedGameId || '');
        setSource('ledger');
      })
      .catch(async () => {
        if (cancelled) return;
        if (requestedGameId) {
          setGameId(requestedGameId);
          setSource('timeline');
          return;
        }
        try {
          const response = await getCurrentGame();
          if (cancelled) return;
          if (response.game.status !== 'WAITING') {
            setGameId(response.game.gameId);
            setSource('timeline');
          } else {
            setGameId('demo');
            setSource('demo');
          }
        } catch {
          if (!cancelled) {
            setGameId('demo');
            setSource('demo');
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestedAgentId, requestedGameId]);

  const simulated = source === 'demo';
  const ledgerMode = source === 'ledger';

  // Ledger mode: refresh the newest page (and the global stats when no game
  // filter applies) on the backend's 5-second cache cadence. Paginated tail
  // rows survive each head refresh; tradeId keeps the merge stable.
  useEffect(() => {
    if (!ledgerMode) return;
    let stopped = false;
    pagedRef.current = false;
    setApiTrades([]);
    setNextAfter(null);
    setFeedError(false);

    const query = {
      gameId: requestedGameId || undefined,
      agentId: requestedAgentId || undefined,
      goodId: filter === 'all' ? undefined : filter,
      limit: LEDGER_PAGE_SIZE,
    };

    async function refresh(signal?: AbortSignal) {
      try {
        const [page, stats] = await Promise.all([
          getLedgerTrades(query, signal),
          requestedGameId
            ? Promise.resolve(null)
            : getLedgerStats(signal).catch(() => null),
        ]);
        if (stopped) return;
        setExplorerTemplate(page.explorerTxUrlTemplate || null);
        if (stats) setApiStats(stats);
        const head = page.trades.map(mapLedgerApiTrade);
        setApiTrades((current) => mergeLedgerHead(head, current));
        if (!pagedRef.current) setNextAfter(page.nextAfter);
        setFeedError(false);
      } catch (cause) {
        if (!stopped && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setFeedError(true);
        }
      }
    }

    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [ledgerMode, requestedAgentId, requestedGameId, filter]);

  async function loadMore() {
    if (!nextAfter || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getLedgerTrades({
        gameId: requestedGameId || undefined,
        agentId: requestedAgentId || undefined,
        goodId: filter === 'all' ? undefined : filter,
        after: nextAfter,
        limit: LEDGER_PAGE_SIZE,
      });
      pagedRef.current = true;
      setExplorerTemplate(page.explorerTxUrlTemplate || null);
      const more = page.trades.map(mapLedgerApiTrade);
      setApiTrades((current) => {
        const seen = new Set(current.map((trade) => trade.tradeId));
        return [...current, ...more.filter((trade) => !seen.has(trade.tradeId))];
      });
      setNextAfter(page.nextAfter);
    } catch {
      setFeedError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (source !== 'timeline' || !gameId) return;
    // A fresh table starts from a clean slate; sequences from another game
    // must never remain visible while the next feed is connecting.
    setLiveFeed(null);
    setFeedError(false);
    return startLiveGameFeed({
      gameId,
      includeState: false,
      onSnapshot(snapshot) {
        setLiveFeed(snapshot);
        setFeedError(Boolean(snapshot.error || snapshot.delayed));
      },
    });
  }, [source, gameId]);

  const liveEvents =
    liveFeed?.gameId === gameId ? liveFeed.events : [];
  const events = simulated ? DEMO_LEDGER_EVENTS : liveEvents;
  const replayTrades = useMemo(() => buildLedgerTrades(events), [events]);
  const trades = ledgerMode ? apiTrades : replayTrades;
  const stats = useMemo(() => buildLedgerStats(trades), [trades]);
  // Ledger mode filters on the server so cursors stay consistent; the replay
  // and demo feeds filter locally as before.
  const visibleTrades = ledgerMode
    ? trades
    : filter === 'all'
      ? trades
      : trades.filter((trade) => trade.goodId === filter);

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
          className={`ledger-feed-line ${!simulated && source !== 'resolving' && !feedError ? 'is-live' : ''}`}
        >
          <span className="ledger-feed-dot" aria-hidden="true" />
          <span>
            {source === 'resolving'
              ? 'Locating the public ledger…'
              : simulated
                ? 'Scripted demonstration feed'
                : feedError
                  ? 'Public feed unreachable · showing last known entries'
                  : ledgerMode
                    ? requestedGameId
                      ? requestedAgentId
                        ? `Player ledger · ${requestedAgentId} · game ${requestedGameId}`
                        : `Public trade ledger · game ${requestedGameId}`
                      : 'Public trade ledger · all games'
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
        {ledgerMode && !requestedGameId && apiStats ? (
          <>
            <div>
              <strong>{apiStats.totalTrades}</strong>
              <span>Trades on chain</span>
            </div>
            <div>
              <strong>{formatGold(Number(apiStats.totalAmountAtomic))}</strong>
              <span>Gold settled</span>
            </div>
            <div>
              <strong>{apiStats.agentCount}</strong>
              <span>Agents on ledger</span>
            </div>
            <div>
              <strong>{confirmedTimeLabel(stats.lastConfirmedAt)}</strong>
              <span>Last chain seal</span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
          <>
            <div className="ledger-rows">
              {visibleTrades.map((trade) => (
                <TradeRow
                  key={trade.tradeId || trade.pairingId}
                  trade={trade}
                  simulated={simulated}
                  gameId={gameId || 'demo'}
                  explorerTemplate={explorerTemplate}
                  showGame={ledgerMode && !requestedGameId}
                />
              ))}
            </div>
            {ledgerMode && nextAfter && (
              <button
                type="button"
                className="ledger-load-more"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? 'Turning the page…' : 'Older entries'}
              </button>
            )}
          </>
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
