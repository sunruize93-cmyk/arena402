'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AgentReputationCard from '@/components/AgentReputationCard';
import InitialLoadoutEditor from '@/components/InitialLoadoutEditor';
import { listBindings } from '@/lib/connector-api';
import {
  createPaymentMandate,
  CurrentGame,
  getArenaWallet,
  getJoinPreflight,
  getPaymentMandate,
  isJoinPreflightReady,
  JoinPreflight,
  joinCurrentGame,
  revokeCurrentGameMandate,
} from '@/lib/game-api';
import { getHostedAgents } from '@/lib/hosted-agent-api';
import {
  evaluateInitialLoadout,
  InitialLoadout,
  RECOMMENDED_LOADOUT,
} from '@/lib/initial-loadout';
import { ArenaApiError } from '@/lib/platform-api';

type EntryStep = 'agent' | 'loadout' | 'mandate';
type EntryRequestStage =
  | 'wallet'
  | 'preflight'
  | 'mandate_lookup'
  | 'mandate_revoke'
  | 'mandate_create'
  | 'join';

interface ReadyAgent {
  agentId: string;
  displayName: string;
  runtimeKind: string;
}

function opaqueId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`.slice(0, 128);
}

function safeEntryError(
  error: unknown,
  stage: EntryRequestStage,
): string {
  if (error instanceof ArenaApiError) {
    if (error.code === 'network_unavailable') {
      const networkMessages: Record<EntryRequestStage, string> = {
        wallet:
          'The wallet check could not reach Arena after one automatic retry. Retry preflight.',
        preflight:
          'The readiness check could not reach Arena after one automatic retry. Retry preflight.',
        mandate_lookup:
          'Arena could not confirm the current payment mandate after one automatic retry. Retry the same entry.',
        mandate_revoke:
          'Arena could not replace the previous payment mandate after one automatic retry. Retry the same entry.',
        mandate_create:
          'Arena could not confirm the payment mandate after one automatic retry. Retry the same entry; its idempotency key is preserved.',
        join:
          'Arena could not confirm the seat after one automatic retry. Retry the same entry; Arena will reuse the original join request.',
      };
      return networkMessages[stage];
    }
    const messages: Record<string, string> = {
      authentication_required: 'Sign in again before entering the pool.',
      runtime_not_ready: 'This Agent runtime is not ready for the current game.',
      wallet_not_ready: 'Arena could not prepare the game wallet.',
      wallet_pool_exhausted: 'No game wallet is currently available.',
      game_already_started: 'This game has already started.',
      game_not_current: 'This is no longer the current Arena game.',
      game_not_joinable: 'This game is no longer accepting entries.',
      settlement_not_available: 'Payment settlement is not ready for this game.',
      game_participant_limit_reached: 'The current pool is full.',
      user_already_joined: 'Your account already has a seat in this game.',
      hosted_agent_not_ready: 'This Hosted Agent is not ready for the current game.',
      mandate_not_ready: 'The payment mandate is no longer valid. Retry preflight.',
      join_authorization_expired: 'The entry authorization expired. Retry preflight.',
      invalid_portfolio: 'The server rejected this opening portfolio.',
      invalid_idempotency_key: 'Arena could not verify the retry key. Return and review the entry again.',
      csrf_session_unavailable: 'Arena could not verify this browser session. Sign in again.',
      idempotency_conflict: 'The entry request changed. Return and review it again.',
      request_aborted: 'The entry check was cancelled.',
    };
    return messages[error.code] || `Arena declined the entry request (${error.code}).`;
  }
  return 'Arena could not complete this entry request. No seat was created.';
}

function preflightRefusal(code: string | null): string {
  const messages: Record<string, string> = {
    authentication_required: 'Sign in again before entering the pool.',
    runtime_not_ready: 'This Agent runtime is not ready for the current game.',
    wallet_not_ready: 'Arena could not prepare the game wallet.',
    wallet_pool_exhausted: 'No game wallet is currently available.',
    game_already_started: 'This game has already started.',
    game_not_current: 'This is no longer the current Arena game.',
    settlement_not_available: 'Payment settlement is not ready for this game.',
    game_participant_limit_reached: 'The current pool is full.',
    user_already_joined: 'Your account already has a seat in this game.',
  };
  return (
    (code && messages[code])
    || 'Arena preflight did not authorize this Agent to enter the current pool.'
  );
}

export default function GameEntryDesk({
  game,
  onClose,
  onJoined,
}: {
  game: CurrentGame;
  onClose: () => void;
  onJoined: (participantId: string) => void;
}) {
  const [step, setStep] = useState<EntryStep>('agent');
  const [agents, setAgents] = useState<ReadyAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loadout, setLoadout] = useState<InitialLoadout>({
    ...RECOMMENDED_LOADOUT,
  });
  const [preflight, setPreflight] = useState<JoinPreflight | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const stableValues = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([getHostedAgents(), listBindings()]).then(
      ([hostedResult, bindingResult]) => {
        if (cancelled) return;
        const hosted =
          hostedResult.status === 'fulfilled'
            ? hostedResult.value
                .filter(
                  (agent) =>
                    agent.provisioningStatus === 'ready'
                    && agent.routeStatus === 'ready',
                )
                .map((agent) => ({
                  agentId: agent.agentId,
                  displayName: agent.displayName,
                  runtimeKind: 'hosted',
                }))
            : [];
        const local =
          bindingResult.status === 'fulfilled'
            ? bindingResult.value
                .filter(
                  (binding) =>
                    Boolean(binding.agent_id)
                    && binding.status === 'available',
                )
                .map((binding) => ({
                  agentId: String(binding.agent_id),
                  displayName: binding.display_name || String(binding.agent_id),
                  runtimeKind: binding.runtime_kind || 'local_connector',
                }))
            : [];
        const unique = new Map<string, ReadyAgent>();
        for (const agent of [...hosted, ...local]) unique.set(agent.agentId, agent);
        setAgents([...unique.values()]);
        setAgentsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAgent = agents.find((agent) => agent.agentId === selectedAgentId);
  const loadoutResult = useMemo(
    () => evaluateInitialLoadout(loadout),
    [loadout],
  );
  const selectedReputation = game.participants.find(
    (participant) => participant.agentId === selectedAgentId,
  )?.reputation;

  function stableValue(kind: string, content: unknown): string {
    const identity = `${kind}:${JSON.stringify(content)}`;
    const current = stableValues.current.get(identity);
    if (current) return current;
    const next = opaqueId(`web-${kind}`);
    stableValues.current.set(identity, next);
    return next;
  }

  function stableTime(kind: string, content: unknown): string {
    const identity = `time:${kind}:${JSON.stringify(content)}`;
    const current = stableValues.current.get(identity);
    if (current) return current;
    const next = new Date().toISOString();
    stableValues.current.set(identity, next);
    return next;
  }

  async function prepareMandate() {
    if (!selectedAgent || !loadoutResult.portfolio || working) return;
    setStep('mandate');
    setWorking(true);
    setError('');
    let requestStage: EntryRequestStage = 'wallet';
    try {
      await getArenaWallet();
      requestStage = 'preflight';
      const content = {
        gameId: game.gameId,
        agentId: selectedAgent.agentId,
        portfolio: loadoutResult.portfolio,
      };
      const nextPreflight = await getJoinPreflight(
        game.gameId,
        selectedAgent.agentId,
        stableValue('preflight', content),
      );
      if (!isJoinPreflightReady(nextPreflight)) {
        setPreflight(null);
        setError(preflightRefusal(nextPreflight.safeErrorCode));
        return;
      }
      setPreflight(nextPreflight);
    } catch (cause) {
      setPreflight(null);
      setError(safeEntryError(cause, requestStage));
    } finally {
      setWorking(false);
    }
  }

  async function approveAndJoin() {
    if (
      !selectedAgent
      || !loadoutResult.portfolio
      || !preflight
      || !isJoinPreflightReady(preflight)
      || working
    ) {
      return;
    }
    setWorking(true);
    setError('');
    const requirements = preflight.mandateRequirements;
    const entryContent = {
      gameId: game.gameId,
      agentId: selectedAgent.agentId,
      joinAuthorizationId: preflight.joinAuthorizationId,
      portfolio: loadoutResult.portfolio,
    };
    let requestStage: EntryRequestStage = 'mandate_lookup';
    try {
      const currentMandate = await getPaymentMandate(game.gameId);
      const reusable =
        currentMandate.mandate
        && currentMandate.mandate.joinAuthorizationId
          === preflight.joinAuthorizationId
        && !currentMandate.mandate.revokedAt
        && new Date(currentMandate.mandate.expiresAt).getTime() > Date.now();
      let mandate = currentMandate.mandate;
      if (!reusable || !mandate) {
        if (mandate) {
          requestStage = 'mandate_revoke';
          await revokeCurrentGameMandate(mandate.mandateId);
        }
        requestStage = 'mandate_create';
        mandate = (
          await createPaymentMandate(
            {
              mandateId: stableValue('mandate-id', entryContent),
              gameId: game.gameId,
              joinAuthorizationId: preflight.joinAuthorizationId,
              chainId: requirements.chainId,
              tokenAddress: requirements.tokenAddress,
              maxPerPaymentAtomic: requirements.maxPerPaymentAtomic,
              maxCumulativeAtomic: requirements.maxCumulativeAtomic,
              allowedPayeeRule: requirements.allowedPayeeRule,
              validFrom: stableTime('mandate-valid-from', entryContent),
              expiresAt: requirements.expiresAt,
            },
            stableValue('mandate', entryContent),
          )
        ).mandate;
      }
      requestStage = 'join';
      const response = await joinCurrentGame(
        game.gameId,
        {
          agentId: selectedAgent.agentId,
          joinAuthorizationId: preflight.joinAuthorizationId,
          paymentMandateId: mandate.mandateId,
          portfolio: loadoutResult.portfolio,
        },
        stableValue('join', {
          ...entryContent,
          paymentMandateId: mandate.mandateId,
        }),
      );
      const participantId =
        response.participant?.participantId || response.participantId;
      if (!participantId) throw new Error('participant_id_missing');
      window.localStorage.setItem(
        `arena402:participant:${game.gameId}`,
        participantId,
      );
      onJoined(participantId);
    } catch (cause) {
      setError(safeEntryError(cause, requestStage));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="gm-entry-backdrop" role="presentation">
      <section
        className="gm-entry-desk"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-entry-title"
      >
        <header className="gm-entry-head">
          <div>
            <p className="label">Current game · Entry desk</p>
            <h2 className="display" id="game-entry-title">
              {step === 'agent' && 'Choose your piece'}
              {step === 'loadout' && 'Compose twenty gold'}
              {step === 'mandate' && 'Seal one game mandate'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close entry desk">
            ×
          </button>
        </header>

        <ol className="gm-entry-progress" aria-label="Entry progress">
          {[
            ['agent', '01', 'Agent'],
            ['loadout', '02', 'Loadout'],
            ['mandate', '03', 'Mandate'],
          ].map(([id, number, label]) => (
            <li
              className={step === id ? 'is-active' : ''}
              aria-current={step === id ? 'step' : undefined}
              key={id}
            >
              <span>{number}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="gm-entry-body">
          {step === 'agent' && (
            <>
              <p className="sec-sub gm-entry-intro">
                Select one ready Agent. Once the seat is sealed, the Agent—not
                the player—makes every market decision.
              </p>
              {agentsLoading ? (
                <p className="data-state">Reading your ready Agents…</p>
              ) : agents.length > 0 ? (
                <div className="gm-entry-agents" role="radiogroup" aria-label="Ready Agents">
                  {agents.map((agent) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedAgentId === agent.agentId}
                      className={selectedAgentId === agent.agentId ? 'is-selected' : ''}
                      key={agent.agentId}
                      onClick={() => {
                        setSelectedAgentId(agent.agentId);
                        setPreflight(null);
                        setError('');
                      }}
                    >
                      <span className="label">{agent.runtimeKind}</span>
                      <strong>{agent.displayName}</strong>
                      <small>{agent.agentId}</small>
                      <AgentReputationCard
                        reputation={
                          game.participants.find(
                            (participant) => participant.agentId === agent.agentId,
                          )?.reputation
                        }
                        compact
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="gm-entry-empty">
                  <p>No ready Agent is available for this Arena identity.</p>
                  <Link className="btn" href="/agents">
                    Back to Agents
                  </Link>
                </div>
              )}
            </>
          )}

          {step === 'loadout' && (
            <>
              <p className="sec-sub gm-entry-intro">
                Goods use the frozen opening price. Cash is the read-only
                remainder, so every valid combination stays exactly at 20 gold.
              </p>
              <InitialLoadoutEditor value={loadout} onChange={setLoadout} />
            </>
          )}

          {step === 'mandate' && (
            <>
              <p className="sec-sub gm-entry-intro">
                This mandate is limited to one game, one Agent, the Arena
                settlement account, and the server-issued expiry.
              </p>
              {working && !preflight ? (
                <p className="data-state">Checking runtime, wallet, and game capacity…</p>
              ) : preflight ? (
                <div className="gm-mandate-review">
                  <dl>
                    <div><dt>Agent</dt><dd>{selectedAgent?.displayName}</dd></div>
                    <div><dt>Game</dt><dd>{game.gameId}</dd></div>
                    <div>
                      <dt>Payment ceiling</dt>
                      <dd>{preflight.mandateRequirements.maxCumulativeAtomic} atomic</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {new Date(
                          preflight.mandateRequirements.expiresAt,
                        ).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <InitialLoadoutEditor
                    value={loadout}
                    onChange={setLoadout}
                    locked
                  />
                  <AgentReputationCard reputation={selectedReputation} />
                </div>
              ) : null}
            </>
          )}

          {error && <p className="data-state error" role="alert">{error}</p>}
        </div>

        <footer className="gm-entry-actions">
          {step !== 'agent' ? (
            <button
              type="button"
              className="gm-text-link"
              disabled={working}
              onClick={() => {
                setError('');
                setStep(step === 'mandate' ? 'loadout' : 'agent');
              }}
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step === 'agent' && agents.length > 0 && (
            <button
              type="button"
              className="btn gm-primary-action"
              disabled={!selectedAgentId}
              onClick={() => setStep('loadout')}
            >
              Select this Agent
            </button>
          )}
          {step === 'loadout' && (
            <button
              type="button"
              className="btn gm-primary-action"
              disabled={!loadoutResult.isValid || working}
              onClick={() => void prepareMandate()}
            >
              Lock 20 Gold Loadout
            </button>
          )}
          {step === 'mandate' && preflight && (
            <button
              type="button"
              className="btn gm-primary-action"
              disabled={working}
              onClick={() => void approveAndJoin()}
            >
              {working ? 'Sealing entry…' : 'Approve mandate & join pool'}
            </button>
          )}
          {step === 'mandate' && !preflight && !working && (
            <button
              type="button"
              className="btn gm-primary-action"
              onClick={() => void prepareMandate()}
            >
              Retry preflight
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
