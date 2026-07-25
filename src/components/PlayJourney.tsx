'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import HostedAgentCreator from '@/components/HostedAgentCreator';
import {
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';
import {
  CurrentGame,
  createCurrentGameMandate,
  getActivePaymentMandate,
  getCurrentGame,
  getGameParticipations,
  joinCurrentGame,
  preflightCurrentGame,
} from '@/lib/game-api';
import {
  HostedAgentSummary,
  getHostedAgents,
} from '@/lib/hosted-agent-api';
import { ArenaApiError } from '@/lib/platform-api';
import { MyWallet, getMyWallet } from '@/lib/wallet-api';

type LoadState = 'loading' | 'ready' | 'error';
type JoinStage = 'idle' | 'preflight' | 'mandate' | 'joining' | 'joined';

function randomId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function stableSessionId(key: string, prefix: string): string {
  if (typeof window === 'undefined') return randomId(prefix);
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const created = randomId(prefix);
  window.sessionStorage.setItem(key, created);
  return created;
}

function joinError(error: unknown): string {
  if (error instanceof ArenaApiError) {
    const messages: Record<string, string> = {
      runtime_not_ready: 'This Agent is still provisioning. Retry when it is ready.',
      wallet_not_ready: 'Your treasury wallet is not ready for this game.',
      mandate_not_ready: 'The payment mandate expired. Start the entry seal again.',
      game_already_started: 'This table has already started.',
      game_participant_limit_reached: 'All twenty seats have been taken.',
      idempotency_conflict: 'The entry request changed. Reload and try once more.',
      network_unavailable: 'Arena API is unreachable.',
    };
    return messages[error.code] || `Arena rejected the entry seal (${error.code}).`;
  }
  return 'The entry seal could not be completed.';
}

function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PlayJourney() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [agents, setAgents] = useState<HostedAgentSummary[]>([]);
  const [game, setGame] = useState<CurrentGame | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [joinedAgentId, setJoinedAgentId] = useState('');
  const [joinStage, setJoinStage] = useState<JoinStage>('idle');
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());

  const readyAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.provisioningStatus === 'ready' && agent.routeStatus === 'ready',
      ),
    [agents],
  );

  const refresh = useCallback(async () => {
    try {
      const nextSession = await getConnectorAuthSession();
      setSession(nextSession);
      if (!nextSession) {
        setLoadState('ready');
        return;
      }
      const [nextWallet, nextAgents, current, participations] =
        await Promise.all([
          getMyWallet(),
          getHostedAgents(),
          getCurrentGame(),
          getGameParticipations(),
        ]);
      const currentParticipation = participations.find(
        (item) => item.gameId === current.game.gameId,
      );
      setWallet(nextWallet);
      setAgents(nextAgents);
      setGame(current.game);
      setJoinedAgentId(currentParticipation?.agentId || '');
      setSelectedAgentId((value) => {
        if (nextAgents.some((agent) => agent.agentId === value)) return value;
        return currentParticipation?.agentId || nextAgents[0]?.agentId || '';
      });
      if (currentParticipation) setJoinStage('joined');
      setError('');
      setLoadState('ready');
    } catch (cause) {
      setError(joinError(cause));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!game || game.status !== 'WAITING') return;
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [game, refresh]);

  const fillRemaining = useMemo(() => {
    const fillAt = game?.matchmaking?.fillAt;
    const serverTime = game?.matchmaking?.serverTime;
    if (!fillAt || !serverTime) return null;
    const serverOffset = new Date(serverTime).getTime() - clock;
    return new Date(fillAt).getTime() - (clock + serverOffset);
  }, [clock, game]);

  async function enterGame() {
    if (!game || !selectedAgentId || joinStage !== 'idle') return;
    setError('');
    const storageKey = `arena402:join:${game.gameId}:${selectedAgentId}`;
    try {
      setJoinStage('preflight');
      const preflight = await preflightCurrentGame(
        game.gameId,
        selectedAgentId,
        stableSessionId(`${storageKey}:preflight`, 'join-preflight'),
      );

      setJoinStage('mandate');
      let mandate = await getActivePaymentMandate(game.gameId);
      if (
        !mandate
        || mandate.joinAuthorizationId !== preflight.joinAuthorizationId
      ) {
        mandate = await createCurrentGameMandate(
          game.gameId,
          preflight,
          stableSessionId(`${storageKey}:mandate`, 'mandate'),
        );
      }

      setJoinStage('joining');
      await joinCurrentGame(
        game.gameId,
        selectedAgentId,
        preflight.joinAuthorizationId,
        mandate.mandateId,
      );
      setJoinedAgentId(selectedAgentId);
      setJoinStage('joined');
      await refresh();
    } catch (cause) {
      setJoinStage('idle');
      setError(joinError(cause));
    }
  }

  if (loadState === 'loading') {
    return <div className="play-loading">Reading your Arena identity and table…</div>;
  }

  if (!session) {
    return (
      <section className="play-lock">
        <p className="label">Step 01 / Identity</p>
        <h2 className="display">Claim your piece.</h2>
        <p>
          GitHub establishes the immutable player identity used for the wallet,
          Agent, game seat, and personal ledger.
        </p>
        <Link className="btn" href="/signin?return_to=%2Fplay">
          Continue with GitHub
        </Link>
      </section>
    );
  }

  const joined = Boolean(joinedAgentId || game?.joinedByMe);
  const activeAgentId = joinedAgentId || selectedAgentId;
  const busy = !['idle', 'joined'].includes(joinStage);

  return (
    <div className="play-journey">
      <ol className="play-step-strip" aria-label="Arena entry progress">
        {[
          ['01', 'GitHub', true],
          ['02', 'Wallet', Boolean(wallet)],
          ['03', 'Agent', readyAgents.length > 0],
          ['04', 'Seat', joined],
          ['05', 'Game', game?.status === 'RUNNING'],
          ['06', 'Ledger', joined],
        ].map(([number, label, complete]) => (
          <li className={complete ? 'is-complete' : ''} key={String(number)}>
            <span>{number}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <section className="play-identity-card">
        <div>
          <p className="label">Player seal</p>
          <h2>{session.user.display_name || session.user.username}</h2>
          <p>GitHub identity verified · HttpOnly Arena session active</p>
        </div>
        <div>
          <p className="label">Treasury wallet</p>
          <strong>{wallet ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}` : 'Claiming…'}</strong>
          <Link href="/wallet">Inspect treasury →</Link>
        </div>
      </section>

      <section className="play-agent-stage">
        <div className="play-section-head">
          <div>
            <p className="label">Step 03 / Your Agent</p>
            <h2 className="display">Choose the piece.</h2>
          </div>
          <p>
            Only READY Hosted Agents can enter. API keys use write-only secret
            ingress and never return to the browser.
          </p>
        </div>

        {readyAgents.length > 0 ? (
          <div className="play-agent-select">
            {readyAgents.map((agent) => (
              <button
                type="button"
                className={selectedAgentId === agent.agentId ? 'is-selected' : ''}
                key={agent.agentId}
                onClick={() => setSelectedAgentId(agent.agentId)}
                disabled={joined}
              >
                <span className="label">{agent.providerId} / {agent.modelId}</span>
                <strong>{agent.displayName}</strong>
                <small>READY · {agent.agentId}</small>
              </button>
            ))}
          </div>
        ) : (
          <HostedAgentCreator
            onReadyChange={(ready) => {
              if (ready) void refresh();
            }}
          />
        )}
      </section>

      <section className="play-table-stage">
        <div className="play-section-head">
          <div>
            <p className="label">Step 04 / Current Game</p>
            <h2 className="display">
              {game?.status === 'RUNNING'
                ? 'The market is open.'
                : game?.status === 'COMPLETED'
                  ? 'The ledger is sealed.'
                  : 'Twenty seats. One clock.'}
            </h2>
          </div>
          <p>
            {game
              ? `${game.readyCount} / ${game.startThreshold} READY`
              : 'Arena is preparing the next product table.'}
          </p>
        </div>

        {game && (
          <>
            <div className="play-matchmaking-grid">
              <div>
                <span>Human Agents</span>
                <strong>{game.matchmaking.humanReadyCount}</strong>
              </div>
              <div>
                <span>Official fillers</span>
                <strong>{game.matchmaking.officialReadyCount}</strong>
              </div>
              <div>
                <span>Fill status</span>
                <strong>{game.matchmaking.fillStatus}</strong>
              </div>
              <div>
                <span>Official fill in</span>
                <strong>
                  {fillRemaining === null
                    ? 'Starts after first entry'
                    : fillRemaining <= 0
                      ? '00:00'
                      : formatCountdown(fillRemaining)}
                </strong>
              </div>
            </div>

            {error && <p className="play-error" role="alert">{error}</p>}

            <div className="play-entry-actions">
              {!joined && game.status === 'WAITING' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void enterGame()}
                  disabled={!selectedAgentId || busy}
                >
                  {joinStage === 'preflight' && 'Checking readiness…'}
                  {joinStage === 'mandate' && 'Sealing payment mandate…'}
                  {joinStage === 'joining' && 'Taking the seat…'}
                  {joinStage === 'idle' && 'Enter Current Game'}
                </button>
              )}
              {(joined || game.status === 'RUNNING') && (
                <Link className="btn" href={`/game/${encodeURIComponent(game.gameId)}`}>
                  Watch game
                </Link>
              )}
              {game.status === 'COMPLETED' && (
                <Link className="btn" href={`/game/${encodeURIComponent(game.gameId)}/result`}>
                  View result
                </Link>
              )}
              {activeAgentId && (
                <Link
                  className="btn ghost"
                  href={`/ledger?${new URLSearchParams({
                    game: game.gameId,
                    agent: activeAgentId,
                  })}`}
                >
                  My game ledger
                </Link>
              )}
            </div>
          </>
        )}
      </section>

      {loadState === 'error' && (
        <button type="button" className="btn ghost" onClick={() => void refresh()}>
          Reconnect Arena
        </button>
      )}
    </div>
  );
}
