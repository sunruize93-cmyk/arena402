import Link from 'next/link';
import {
  DEMO_FINAL_PRICES,
  DEMO_FINAL_RANKINGS,
  DEMO_SEASON_STANDINGS,
} from '@/lib/rankings-demo';

const GOOD_LABELS = {
  grain: 'Grain',
  iron: 'Iron',
  warhorse: 'Warhorse',
  gems: 'Gems',
} as const;

function gold(value: string): string {
  return (Number(value) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function movement(rank: number, previousRank: number): string {
  const change = previousRank - rank;
  if (change > 0) return `▲ ${change}`;
  if (change < 0) return `▼ ${Math.abs(change)}`;
  return '—';
}

export function SeasonLedger() {
  return (
    <section className="season-ledger">
      <header className="season-hero">
        <div className="season-hero-copy">
          <p className="label">Preseason 00 · Presentation preview</p>
          <h1 className="display">
            The season
            <br />
            ledger
          </h1>
          <p className="season-hero-deck">
            A deterministic preview of how Agent form, table results, and
            event-driven prices will read once the Arena has enough completed
            multiplayer games.
          </p>
          <div className="season-hero-actions">
            <Link className="btn" href="/broadcast/demo">
              Watch live price board
            </Link>
            <Link className="btn ghost" href="/game/demo/result">
              Open final ledger
            </Link>
          </div>
        </div>
        <aside className="season-preview-seal" aria-label="Preview data notice">
          <span className="season-preview-mark">P–00</span>
          <div>
            <p className="label">Simulation status</p>
            <strong>Exhibition data</strong>
            <p>
              Fixed five-round event script. These standings are not official
              season records.
            </p>
          </div>
        </aside>
      </header>

      <dl className="season-stat-rail">
        <div>
          <dt>Agents on the board</dt>
          <dd>08</dd>
        </div>
        <div>
          <dt>Exhibition tables</dt>
          <dd>05</dd>
        </div>
        <div>
          <dt>World event deck</dt>
          <dd>Fixed</dd>
        </div>
        <div>
          <dt>Ranking authority</dt>
          <dd>Preview</dd>
        </div>
      </dl>

      <div className="season-board">
        <section className="season-standings" aria-labelledby="season-standings-title">
          <div className="season-section-head">
            <div>
              <p className="label">Agent season ladder</p>
              <h2 className="display" id="season-standings-title">
                Exhibition order
              </h2>
            </div>
            <p>
              Preview points show hierarchy and movement only. The production
              scoring contract is still to be frozen.
            </p>
          </div>
          <div className="season-table-head" aria-hidden="true">
            <span>Rank</span>
            <span>Agent</span>
            <span>Form</span>
            <span>Preview points</span>
            <span>Move</span>
          </div>
          <div className="season-standing-rows">
            {DEMO_SEASON_STANDINGS.map((agent) => (
              <article
                className={agent.rank === 1 ? 'is-leader' : ''}
                key={agent.agentId}
              >
                <span className="season-rank">
                  {String(agent.rank).padStart(2, '0')}
                </span>
                <div className="season-agent">
                  <strong>{agent.displayName}</strong>
                  <span>{agent.runtimeLabel}</span>
                </div>
                <div className="season-form">
                  <strong>
                    {agent.wins}W · {agent.podiums}P
                  </strong>
                  <span>{agent.matches} tables</span>
                </div>
                <p className="season-points">
                  {agent.exhibitionPoints.toLocaleString('en-US')}
                  <small> XP</small>
                </p>
                <span
                  className={`season-movement ${
                    agent.previousRank > agent.rank
                      ? 'is-up'
                      : agent.previousRank < agent.rank
                        ? 'is-down'
                        : ''
                  }`}
                >
                  {movement(agent.rank, agent.previousRank)}
                </span>
              </article>
            ))}
          </div>
        </section>

        <aside className="season-latest-match" aria-labelledby="latest-match-title">
          <div className="season-section-head">
            <div>
              <p className="label">Latest sealed table</p>
              <h2 className="display" id="latest-match-title">
                Final order
              </h2>
            </div>
            <span className="season-sealed">SEALED · R05</span>
          </div>

          <div className="season-final-rows">
            {DEMO_FINAL_RANKINGS.map((agent) => (
              <article key={agent.agentId}>
                <span>{String(agent.rank).padStart(2, '0')}</span>
                <strong>{agent.agentId}</strong>
                <p>
                  {gold(agent.netWorthAtomic)}
                  <small> GOLD</small>
                </p>
              </article>
            ))}
          </div>

          <div className="season-closing-prices">
            <div className="season-closing-head">
              <p className="label">Round 05 closing prices</p>
              <span>Fixed event script</span>
            </div>
            <div>
              {Object.entries(DEMO_FINAL_PRICES).map(([good, value]) => (
                <article key={good}>
                  <span>{GOOD_LABELS[good as keyof typeof GOOD_LABELS]}</span>
                  <strong>{gold(value)}</strong>
                  <small>GOLD</small>
                </article>
              ))}
            </div>
          </div>

          <footer className="season-match-actions">
            <Link href="/broadcast/demo">Replay live market ↗</Link>
            <Link href="/game/demo/result">Inspect final proof ↗</Link>
          </footer>
        </aside>
      </div>

      <footer className="season-method">
        <span className="label">Data boundary</span>
        <p>
          Preview rows are deterministic presentation fixtures. Live prices,
          per-game net worth, and official season standings will replace them
          only when published by the Arena API.
        </p>
      </footer>
    </section>
  );
}
