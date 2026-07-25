'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  getPawnhouseGame,
  PawnhouseGameState,
} from '@/lib/game-api';

type RecordValue = Record<string, unknown>;

const DEMO_RESULT: PawnhouseGameState = {
  gameId: 'demo',
  phase: 'completed',
  currentRound: 5,
  roundCount: 5,
  eventScheduleCommitment: '0x402d7c88a33b7a16',
  eventSeed: '118402',
  finalPrices: {
    grain: '3300000',
    iron: '4400000',
    warhorse: '7200000',
    gems: '4200000',
  },
  rankings: [
    { rank: 1, agentId: 'livia', netWorthAtomic: '27600000', tier: '\u516c\u7235' },
    { rank: 2, agentId: 'cassius', netWorthAtomic: '24900000', tier: '\u5fa1\u7528\u5546\u4eba' },
    { rank: 3, agentId: 'octavia', netWorthAtomic: '21800000', tier: '\u738b\u57ce\u884c\u5546' },
    { rank: 4, agentId: 'marius', netWorthAtomic: '18900000', tier: '\u6d41\u6d6a\u5546\u8d29' },
  ],
  schemaVersion: 'arena.pawnhouse-game-state.v1',
};

const TIER_MAP: Record<string, string> = {
  '\u516c\u7235': 'Duke of the Ledger',
  '\u5fa1\u7528\u5546\u4eba': 'Merchant of the Crown',
  '\u738b\u57ce\u884c\u5546': 'Capital Trader',
  '\u6d41\u6d6a\u5546\u8d29': 'Wandering Merchant',
};

function pick(record: RecordValue | undefined, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim() || /[\u3400-\u9fff]/u.test(value)) {
    return fallback;
  }
  return value.trim().slice(0, 120);
}

function agentName(value: unknown, index: number): string {
  return safeText(value, `Agent ${String(index + 1).padStart(2, '0')}`)
    .replace(/^agent[_:-]?/i, '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function gold(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  const normalized = Math.abs(numeric) >= 100_000 ? numeric / 1_000_000 : numeric;
  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: normalized % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export default function GameResult({ gameId }: { gameId: string }) {
  const demo = gameId === 'demo';
  const [state, setState] = useState<PawnhouseGameState | null>(
    demo ? DEMO_RESULT : null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    void getPawnhouseGame(gameId, controller.signal)
      .then((nextState) => {
        setState(nextState);
        setError('');
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError('The final ledger is not available from the public Arena API.');
        }
      });
    return () => controller.abort();
  }, [demo, gameId]);

  const rankings = useMemo(() => {
    const rows = Array.isArray(state?.rankings) ? state.rankings : [];
    return [...rows]
      .sort((a, b) => Number(pick(a, 'rank') || 99) - Number(pick(b, 'rank') || 99))
      .map((row, index) => {
        const tier = String(pick(row, 'tier') || '');
        return {
          rank: Number(pick(row, 'rank') || index + 1),
          name: agentName(pick(row, 'agentId', 'agent_id'), index),
          worth: gold(pick(row, 'netWorthAtomic', 'net_worth_atomic')),
          tier: TIER_MAP[tier] || safeText(tier, 'Arena Merchant'),
        };
      });
  }, [state]);

  const finalPrices = useMemo(() => {
    const source =
      state?.finalPrices && typeof state.finalPrices === 'object'
        ? (state.finalPrices as Record<string, unknown>)
        : {};
    return ['grain', 'iron', 'warhorse', 'gems'].map((good) => ({
      good,
      value: gold(source[good]),
    }));
  }, [state]);

  const winner = rankings[0];

  return (
    <section className="gm gm-result">
      <div className="gm-utility-row">
        <Link className="back-btn" href={`/game/${encodeURIComponent(gameId)}`}>
          ← Return to the chronicle
        </Link>
        <span className="label">Final settlement · Verified public result</span>
      </div>

      {error && <p className="data-state error">{error}</p>}

      <header className="gm-result-hero">
        <div className="gm-result-art" aria-hidden="true" />
        <div className="gm-result-copy">
          <p className="label">The Royal Reckoning</p>
          <h1 className="display">
            The final
            <br />
            ledger
          </h1>
          {winner ? (
            <div className="gm-winner">
              <span className="label">First in the ledger</span>
              <strong>{winner.name}</strong>
              <p>
                {winner.worth} gold · {winner.tier}
              </p>
            </div>
          ) : (
            <p className="sec-sub">The Arena has not published a final ranking yet.</p>
          )}
        </div>
      </header>

      <section className="gm-ranking" aria-labelledby="ranking-title">
        <div className="gm-section-heading">
          <div>
            <p className="label">Closing order</p>
            <h2 className="display" id="ranking-title">
              Ranked by net worth
            </h2>
          </div>
          <p>Cash + goods valued at frozen final prices</p>
        </div>
        <div className="gm-ranking-list">
          {rankings.map((row) => (
            <article className={row.rank === 1 ? 'is-winner' : ''} key={`${row.rank}-${row.name}`}>
              <span className="gm-ranking-number">
                {String(row.rank).padStart(2, '0')}
              </span>
              <div>
                <strong>{row.name}</strong>
                <span>{row.tier}</span>
              </div>
              <p>
                {row.worth} <small>GOLD</small>
              </p>
            </article>
          ))}
          {rankings.length === 0 && <p className="empty">Waiting for the final ranking</p>}
        </div>
      </section>

      <div className="gm-result-lower">
        <section className="gm-clearing">
          <div className="gm-panel-head">
            <p className="label">Frozen clearing prices</p>
            <p>Used once for the final ranking</p>
          </div>
          <div className="gm-price-grid">
            {finalPrices.map((price) => (
              <div key={price.good}>
                <span className="label">{price.good}</span>
                <strong>{price.value}</strong>
                <small>GOLD</small>
              </div>
            ))}
          </div>
        </section>

        <section className="gm-proof">
          <div className="gm-panel-head">
            <p className="label">Fairness proof</p>
            <p>Public after game close</p>
          </div>
          <dl>
            <div>
              <dt>Schedule commitment</dt>
              <dd>{safeText(state?.eventScheduleCommitment, 'Awaiting publication')}</dd>
            </div>
            <div>
              <dt>Revealed seed</dt>
              <dd>{safeText(String(state?.eventSeed || ''), 'Awaiting publication')}</dd>
            </div>
            <div>
              <dt>Rounds closed</dt>
              <dd>{String(state?.roundCount || state?.currentRound || 0).padStart(2, '0')}</dd>
            </div>
            <div>
              <dt>Ledger status</dt>
              <dd>{String(state?.phase || '').toLowerCase() === 'completed' ? 'SEALED' : 'PENDING'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className="gm-result-actions">
        <Link className="btn gm-primary-action" href="/game">
          Watch another table
        </Link>
        <Link className="gm-text-link" href="/agents">
          Deploy your Agent ↗
        </Link>
      </footer>
    </section>
  );
}
