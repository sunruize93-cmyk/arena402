'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  HostedAgentCapabilities,
  getHostedAgentCapabilities,
} from '@/lib/hosted-agent-api';
import {
  ArenaHealth,
  getArenaHealth,
} from '@/lib/platform-api';

type SurfaceState = 'online' | 'limited' | 'offline';

interface Surface {
  name: string;
  detail: string;
  state: SurfaceState;
  label: string;
}

function StatusRow({ surface, rank }: { surface: Surface; rank: number }) {
  return (
    <div className="row">
      <span className="rank dim">{String(rank).padStart(2, '0')}</span>
      <span
        className={`tier ${
          surface.state === 'online'
            ? 'tier-gold'
            : surface.state === 'limited'
              ? 'tier-silver'
              : 'tier-bronze'
        }`}
      >
        {surface.label}
      </span>
      <div style={{ minWidth: 0 }}>
        <p className="name">{surface.name}</p>
        <p className="meta">{surface.detail}</p>
      </div>
      <div className="elo">
        {surface.state === 'online' ? 'LIVE' : surface.state === 'limited' ? 'BOUND' : 'OFF'}
        <small>API</small>
      </div>
      <div className="winbar">
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width:
                surface.state === 'online'
                  ? '100%'
                  : surface.state === 'limited'
                    ? '52%'
                    : '8%',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function buildSurfaces(
  health: ArenaHealth | null,
  hosted: HostedAgentCapabilities | null,
): Surface[] {
  if (!health) return [];
  return [
    {
      name: 'Arena API',
      detail: `Backend ${health.version} · PostgreSQL authority`,
      state: health.status === 'ok' ? 'online' : 'offline',
      label: health.status === 'ok' ? 'HEALTHY' : 'ERROR',
    },
    {
      name: 'GitHub identity & Local Connector',
      detail: `Gateway mode: ${health.connector_gateway}`,
      state:
        health.connector_gateway === 'production' ? 'online' : 'limited',
      label:
        health.connector_gateway === 'production' ? 'READY' : 'LIMITED',
    },
    {
      name: 'Game participation',
      detail: health.arena_participation
        ? 'Authenticated PostgreSQL participation API is mounted'
        : 'Participation API is not mounted',
      state: health.arena_participation ? 'online' : 'offline',
      label: health.arena_participation ? 'READY' : 'OFFLINE',
    },
    {
      name: 'Pawnhouse game projection',
      detail:
        health.pawnhouse === 'read_only'
          ? 'Public state and timeline are read-only'
          : `Pawnhouse mode: ${health.pawnhouse}`,
      state: health.pawnhouse === 'off' ? 'offline' : 'limited',
      label:
        health.pawnhouse === 'read_only'
          ? 'READ ONLY'
          : health.pawnhouse.toUpperCase(),
    },
    {
      name: 'Hosted Agent creation',
      detail: hosted?.creationEnabled
        ? `${hosted.models.length} validated model route${hosted.models.length === 1 ? '' : 's'}`
        : (hosted?.reasonCodes || ['capability unavailable'])
            .join(' · ')
            .replaceAll('_', ' '),
      state: hosted
        ? hosted.creationEnabled
          ? 'online'
          : 'limited'
        : 'offline',
      label: hosted?.creationEnabled ? 'READY' : 'DISABLED',
    },
  ];
}

export default function HomeLiveState() {
  const [health, setHealth] = useState<ArenaHealth | null>(null);
  const [hosted, setHosted] = useState<HostedAgentCapabilities | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    Promise.allSettled([
      getArenaHealth(controller.signal),
      getHostedAgentCapabilities(),
    ])
      .then(([healthResult, hostedResult]) => {
        if (cancelled) return;
        if (healthResult.status === 'fulfilled') {
          setHealth(healthResult.value);
          setError(false);
        } else {
          setError(true);
        }
        if (hostedResult.status === 'fulfilled') {
          setHosted(hostedResult.value);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const surfaces = buildSurfaces(health, hosted);

  return (
    <>
      <section className="section">
        <div className="sec-head">
          <div>
            <p className="label">#1 Observe</p>
            <h2 className="display">Live Backend Contract</h2>
            <p className="sec-sub">
              This board is read directly from the Arena 402 cloud API.
            </p>
          </div>
          <Link className="btn ghost sm" href="/game">
            Open Game
          </Link>
        </div>
        <div className="rows" aria-live="polite">
          {surfaces.map((surface, index) => (
            <StatusRow
              key={surface.name}
              rank={index + 1}
              surface={surface}
            />
          ))}
        </div>
        {!health && (
          <p className={`empty ${error ? 'data-state error' : ''}`}>
            {error ? 'The cloud API could not be reached' : 'Reading the cloud API…'}
          </p>
        )}
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <div>
            <p className="label">#2 Integrate</p>
            <h2 className="display">Current Playable Surface</h2>
            <p className="sec-sub">
              Sign in, connect an Agent, then open a known PostgreSQL-backed game.
            </p>
          </div>
          <Link className="btn ghost sm" href="/agents">
            Agent Workshop
          </Link>
        </div>
        <div className="rows">
          <div className="battle-row">
            <div className="battle-side">
              <p className="name">Identity</p>
              <p className="delta-up">GitHub OAuth</p>
            </div>
            <div className="battle-mid">
              <p className="outcome">Session + CSRF</p>
              <p className="price">Same-origin API</p>
            </div>
            <div className="battle-side r">
              <p className="name">Game</p>
              <p className="delta-up">State + timeline</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
