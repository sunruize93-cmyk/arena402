'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthSession } from '@/components/AuthSessionProvider';
import {
  GameParticipation,
  getGameParticipations,
} from '@/lib/game-api';

const BOARD_MODULES = [
  {
    id: 'prices',
    index: '01',
    title: 'Current round prices',
    summary: 'The four official reference prices and round-over-round movement.',
    detail:
      'Open the live board to compare Grain, Iron, Warhorse, and Gems without leaving the current game.',
  },
  {
    id: 'market-history',
    index: '02',
    title: 'Round price history',
    summary: 'Four small-multiple OHLC views aligned to the same round events.',
    detail:
      'Authoritative candles are shown when the Arena API publishes committed OHLC. Otherwise the board labels its event-derived price path.',
  },
  {
    id: 'ladder',
    index: '03',
    title: 'Live ladder',
    summary: 'Server-published mark-to-market or final net-worth order.',
    detail:
      'A confirmed seat is never presented as a rank. The board waits for an Arena-owned valuation snapshot.',
  },
  {
    id: 'event-wire',
    index: '04',
    title: 'Current round event wire',
    summary: 'World events, decisions, pairings, negotiations, and settlement news.',
    detail:
      'Every item retains its public timeline sequence so a match can be reviewed against the Arena ledger.',
  },
] as const;

export default function PlayerArenaObservatory() {
  const { session, loading: sessionLoading } = useAuthSession();
  const [participations, setParticipations] = useState<GameParticipation[]>([]);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    if (!session) {
      setLoading(false);
      return;
    }
    void getGameParticipations()
      .then((values) => {
        if (!cancelled) {
          setParticipations(values);
          setSelectedParticipationId(values[0]?.gameAgentId || '');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParticipations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  if (loading) {
    return (
      <section className="section player-observatory">
        <p className="empty">Reading your Arena participations…</p>
      </section>
    );
  }

  if (!session) return null;

  const current =
    participations.find(
      (participation) =>
        participation.gameAgentId === selectedParticipationId,
    ) || participations[0];
  const gameId = current?.gameId || 'demo';

  return (
    <section className="section player-observatory">
      <div className="sec-head">
        <div>
          <p className="label">#3 Observe</p>
          <h2 className="display">Your Match Observatory</h2>
          <p className="sec-sub">
            Open your Agent&apos;s dialogue, or inspect every layer used by the Expo
            broadcast.
          </p>
        </div>
        <div className="player-observatory-actions">
          <Link className="btn" href="/agents/conversations">
            Open Agent Dialogue
          </Link>
          <Link
            className="btn ghost"
            href={`/broadcast/${encodeURIComponent(gameId)}`}
          >
            {current ? 'Open Live Board' : 'Preview Expo Board'}
          </Link>
        </div>
      </div>

      <div className="player-current-match">
        <div>
          <p className="label">
            {current ? 'Selected participation' : 'Preview mode'}
          </p>
          <strong>{current?.agentId || 'Arena 402 Demo Agent'}</strong>
          <span>
            {current
              ? `${current.gameId} · ${current.status} · ${current.runtimeKind}`
              : 'No joined match yet · deterministic five-round broadcast'}
          </span>
          {participations.length > 1 && (
            <label className="player-participation-select">
              <span>Choose match</span>
              <select
                value={current?.gameAgentId || ''}
                onChange={(event) =>
                  setSelectedParticipationId(event.target.value)
                }
              >
                {participations.map((participation) => (
                  <option
                    key={participation.gameAgentId}
                    value={participation.gameAgentId}
                  >
                    {participation.agentId} · {participation.gameId}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div>
          <Link href={`/game/${encodeURIComponent(gameId)}`}>
            Match chronicle ↗
          </Link>
          {current && (
            <Link
              href={`/game/${encodeURIComponent(gameId)}/result`}
            >
              Final ledger ↗
            </Link>
          )}
        </div>
      </div>

      <div className="player-module-grid">
        {BOARD_MODULES.map((module) => (
          <details className="player-module-card" key={module.id}>
            <summary>
              <span>{module.index}</span>
              <div>
                <strong>{module.title}</strong>
                <p>{module.summary}</p>
              </div>
              <i aria-hidden="true">+</i>
            </summary>
            <div>
              <p>{module.detail}</p>
              <Link
                href={`/broadcast/${encodeURIComponent(gameId)}#${module.id}`}
              >
                Inspect on live board →
              </Link>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
