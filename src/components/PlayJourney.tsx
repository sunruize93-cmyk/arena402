'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  revokeCurrentGameMandate,
} from '@/lib/game-api';
import {
  HostedAgentSummary,
  getHostedAgents,
} from '@/lib/hosted-agent-api';
import { ArenaApiError } from '@/lib/platform-api';
import { MyWallet, getMyWallet } from '@/lib/wallet-api';

type LoadState = 'loading' | 'ready' | 'error';
type JoinStage = 'idle' | 'preflight' | 'mandate' | 'joining' | 'joined';
type ResourceName = 'wallet' | 'agents' | 'game' | 'participation';

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

function joinError(error: unknown, stage: JoinStage = 'idle'): string {
  if (error instanceof ArenaApiError) {
    if (error.code === 'network_unavailable') {
      const stageMessages: Partial<Record<JoinStage, string>> = {
        preflight:
          'Arena could not complete the readiness check after one automatic retry.',
        mandate:
          'Arena could not confirm the payment mandate after one automatic retry. The same request will be reused.',
        joining:
          'Arena could not confirm your seat after one automatic retry. Retry once; the original join request will be reused.',
      };
      return stageMessages[stage] || 'Arena API could not be reached after one automatic retry.';
    }
    const messages: Record<string, string> = {
      authentication_required: 'Your Arena session expired. Sign in again before entering.',
      runtime_not_ready: 'This Agent is still provisioning. Retry when it is ready.',
      wallet_not_ready: 'Your treasury wallet is not ready for this game.',
      wallet_pool_exhausted: 'No game wallet is currently available.',
      mandate_not_ready: 'The payment mandate expired. Start the entry seal again.',
      join_authorization_expired: 'The entry authorization expired. Arena renewed it automatically; try again.',
      active_game_mandate_exists: 'The previous payment mandate is still closing. Try again.',
      game_already_started: 'This table has already started.',
      game_not_current: 'This is no longer the current Arena game.',
      game_not_joinable: 'This table is no longer accepting entries.',
      settlement_not_available: 'Payment settlement is not ready for this game.',
      game_participant_limit_reached: 'This table is full.',
      user_already_joined: 'Your account already has a seat in this game.',
      hosted_agent_not_ready: 'This Hosted Agent is not ready for this game.',
      invalid_portfolio: 'Arena rejected the opening portfolio.',
      csrf_session_unavailable: 'Arena could not verify this browser session. Sign in again.',
      idempotency_conflict: 'The entry request changed. Reload and try once more.',
      request_aborted: 'The Arena request was cancelled.',
    };
    return messages[error.code] || `Arena rejected the entry seal (${error.code}).`;
  }
  return 'The entry seal could not be completed.';
}

function resourceError(resource: ResourceName, error: unknown): string {
  const labels: Record<ResourceName, string> = {
    wallet: 'Treasury wallet',
    agents: 'Hosted Agents',
    game: 'Current Game',
    participation: 'Seat status',
  };
  let code = '';
  if (error instanceof ArenaApiError) {
    code = error.code;
  } else if (error && typeof error === 'object') {
    const candidate = Reflect.get(error, 'code');
    if (typeof candidate === 'string' && /^[a-z0-9_:-]+$/i.test(candidate)) {
      code = candidate;
    }
  }
  return `${labels[resource]} could not be loaded${code ? ` (${code})` : ''}.`;
}

function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PlayJourney() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [agents, setAgents] = useState<HostedAgentSummary[]>([]);
  const [game, setGame] = useState<CurrentGame | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [joinedAgentId, setJoinedAgentId] = useState('');
  const [joinStage, setJoinStage] = useState<JoinStage>('idle');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [clock, setClock] = useState(Date.now());

  const readyAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.provisioningStatus === 'ready' && agent.routeStatus === 'ready',
      ),
    [agents],
  );
  const joined = Boolean(joinedAgentId || game?.joinedByMe);

  const refresh = useCallback(async () => {
    try {
      const nextSession = await getConnectorAuthSession();
      setSession(nextSession);
      if (!nextSession) {
        setLoadState('ready');
        return;
      }
      const [walletResult, agentsResult, gameResult, participationResult] =
        await Promise.allSettled([
          getMyWallet(),
          getHostedAgents(),
          getCurrentGame(),
          getGameParticipations(),
        ]);
      const warnings: string[] = [];

      if (walletResult.status === 'fulfilled') {
        setWallet(walletResult.value);
      } else {
        warnings.push(resourceError('wallet', walletResult.reason));
      }

      let nextAgents: HostedAgentSummary[] | null = null;
      if (agentsResult.status === 'fulfilled') {
        nextAgents = agentsResult.value;
        setAgents(agentsResult.value);
      } else {
        warnings.push(resourceError('agents', agentsResult.reason));
      }

      let current: Awaited<ReturnType<typeof getCurrentGame>> | null = null;
      if (gameResult.status === 'fulfilled') {
        current = gameResult.value;
        setGame(gameResult.value.game);
      } else {
        warnings.push(resourceError('game', gameResult.reason));
      }

      let participations: Awaited<
        ReturnType<typeof getGameParticipations>
      > | null = null;
      if (participationResult.status === 'fulfilled') {
        participations = participationResult.value;
      } else {
        warnings.push(
          resourceError('participation', participationResult.reason),
        );
      }

      const currentParticipation =
        current && participations
          ? participations.find(
              (item) => item.gameId === current.game.gameId,
            )
          : null;
      if (current && participations) {
        setJoinedAgentId(currentParticipation?.agentId || '');
      }
      if (nextAgents) {
        setSelectedAgentId((value) => {
          if (nextAgents.some((agent) => agent.agentId === value)) return value;
          return currentParticipation?.agentId || nextAgents[0]?.agentId || '';
        });
      }
      if (currentParticipation) setJoinStage('joined');
      setLoadError(warnings.join(' '));
      setLoadState(warnings.length === 0 ? 'ready' : 'error');
    } catch (cause) {
      setLoadError(joinError(cause));
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

  useEffect(() => {
    if (!joined || !game || game.status !== 'RUNNING') return;
    router.replace(`/game/${encodeURIComponent(game.gameId)}`);
  }, [game?.gameId, game?.status, joined, router]);

  const fillRemaining = useMemo(() => {
    const fillAt = game?.matchmaking?.fillAt;
    if (!fillAt) return null;
    return new Date(fillAt).getTime() - clock;
  }, [clock, game]);

  async function enterGame() {
    if (!game || !selectedAgentId || joinStage !== 'idle') return;
    setError('');
    const storageKey = `arena402:join:${game.gameId}:${selectedAgentId}`;
    const preflightKey = `${storageKey}:preflight`;
    const mandateKey = `${storageKey}:mandate`;
    const joinKey = `${storageKey}:join`;
    let failedStage: JoinStage = 'preflight';
    try {
      setJoinStage('preflight');
      let preflight;
      try {
        preflight = await preflightCurrentGame(
          game.gameId,
          selectedAgentId,
          stableSessionId(preflightKey, 'join-preflight'),
        );
      } catch (cause) {
        if (
          !(cause instanceof ArenaApiError)
          || cause.code !== 'join_authorization_expired'
        ) {
          throw cause;
        }
        window.sessionStorage.removeItem(preflightKey);
        window.sessionStorage.removeItem(mandateKey);
        preflight = await preflightCurrentGame(
          game.gameId,
          selectedAgentId,
          stableSessionId(preflightKey, 'join-preflight'),
        );
      }

      failedStage = 'mandate';
      setJoinStage('mandate');
      let mandate = await getActivePaymentMandate(game.gameId);
      if (mandate?.joinAuthorizationId !== preflight.joinAuthorizationId) {
        if (mandate) {
          await revokeCurrentGameMandate(mandate.mandateId);
        }
        window.sessionStorage.removeItem(mandateKey);
        mandate = null;
      }
      if (!mandate) {
        mandate = await createCurrentGameMandate(
          game.gameId,
          preflight,
          stableSessionId(mandateKey, 'mandate'),
        );
      }

      failedStage = 'joining';
      setJoinStage('joining');
      await joinCurrentGame(
        game.gameId,
        {
          agentId: selectedAgentId,
          joinAuthorizationId: preflight.joinAuthorizationId,
          paymentMandateId: mandate.mandateId,
        },
        stableSessionId(joinKey, 'join'),
      );
      setJoinedAgentId(selectedAgentId);
      setJoinStage('joined');
      await refresh();
    } catch (cause) {
      setJoinStage('idle');
      setError(joinError(cause, failedStage));
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

  const activeAgentId = joinedAgentId || selectedAgentId;
  const activeAgent = readyAgents.find(
    (agent) => agent.agentId === activeAgentId,
  );
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
          <strong>
            {wallet
              ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`
              : 'Not available yet'}
          </strong>
          <Link href="/wallet">Inspect treasury →</Link>
        </div>
      </section>

      {loadError && (
        <div className="play-error play-load-error" role="alert">
          <div>
            <strong>Some entry checks need attention.</strong>
            <p>{loadError}</p>
          </div>
          <button type="button" className="btn ghost" onClick={() => void refresh()}>
            Retry entry checks
          </button>
        </div>
      )}

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
                  : game
                    ? `${game.startThreshold} ready seats. One clock.`
                    : 'Current Game unavailable.'}
            </h2>
          </div>
          <p>
            {game
              ? `${joined ? 'YOUR SEAT IS CONFIRMED · ' : ''}${game.readyCount} / ${game.startThreshold} READY`
              : 'Retry the entry checks before waiting for matchmaking.'}
          </p>
        </div>

        {game && (
          <>
            {joined && game.status === 'WAITING' && (
              <section
                className="play-seat-receipt"
                aria-labelledby="matchmaking-receipt-title"
                aria-live="polite"
              >
                <div>
                  <p className="label">Matchmaking receipt</p>
                  <h3 id="matchmaking-receipt-title">
                    Your Agent is READY in the waiting game.
                  </h3>
                  <p>
                    {game.matchmaking.fillStatus === 'BLOCKED' ? (
                      <>
                        Automatic official fill is unavailable. The game will
                        wait for more human Agents.
                      </>
                    ) : (
                      <>
                        Arena starts automatically at{' '}
                        <strong>{game.startThreshold} READY</strong>.{' '}
                        <span>No player start button is required.</span>
                      </>
                    )}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Your Agent</dt>
                    <dd>{activeAgent?.displayName || activeAgentId}</dd>
                  </div>
                  <div>
                    <dt>Seat state</dt>
                    <dd>READY</dd>
                  </div>
                  <div>
                    <dt>Ready seats</dt>
                    <dd>{game.readyCount} / {game.startThreshold}</dd>
                  </div>
                  <div>
                    <dt>Still needed</dt>
                    <dd>{Math.max(0, game.startThreshold - game.readyCount)}</dd>
                  </div>
                </dl>
              </section>
            )}

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
                  {game.matchmaking.fillStatus === 'BLOCKED'
                    ? 'Official pool unavailable'
                    : fillRemaining === null
                    ? 'Starts after first entry'
                    : fillRemaining <= 0
                      ? 'Filling now'
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

    </div>
  );
}
