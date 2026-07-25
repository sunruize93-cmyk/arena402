'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AgentReputationCard from '@/components/AgentReputationCard';
import MarketPriceTicker from '@/components/MarketPriceTicker';
import MarketIntelligence from '@/components/MarketIntelligence';
import MatchmakingPool from '@/components/MatchmakingPool';
import NegotiationTerminal from '@/components/NegotiationTerminal';
import SettlementRail from '@/components/SettlementRail';
import { useLocale } from '@/components/LocaleProvider';
import {
  advanceDemoPlayback,
  buildDemoGameState,
  DEMO_INITIAL_EVENT_COUNT,
  DEMO_ROUNDS,
} from '@/lib/game-demo';
import type { DemoPlaybackPosition } from '@/lib/game-demo';
import {
  getPawnhouseGame,
  getPawnhouseTimeline,
  getCurrentGame,
  CurrentGame,
  PawnhouseGameState,
  PawnhouseTimelineEvent,
  withdrawCurrentGameParticipant,
} from '@/lib/game-api';
import { buildLedgerTrades, formatGold } from '@/lib/ledger-model';
import { readAgentReputation } from '@/lib/reputation';
import {
  activePairingIds,
  visibleReplaySnapshots,
} from '@/lib/timeline-projection';

type RecordValue = Record<string, unknown>;
type MarketPhase = 'omen' | 'decide' | 'queue' | 'bargain' | 'seal' | 'closed';

const PHASES: Array<{ id: MarketPhase; roman: string; label: string }> = [
  { id: 'omen', roman: 'I', label: 'Omen' },
  { id: 'decide', roman: 'II', label: 'Orders' },
  { id: 'queue', roman: 'III', label: 'Queue' },
  { id: 'bargain', roman: 'IV', label: 'Bargain' },
  { id: 'seal', roman: 'V', label: 'Seal' },
];

const WORLD_EVENTS: Record<string, { title: string; narrative: string }> = {
  'palace-requisition': {
    title: 'Palace Requisition',
    narrative:
      'War returns to the northern border. The Crown is buying a limited reserve of iron at a royal premium.',
  },
  'new-iron-mine': {
    title: 'The New Iron Mine',
    narrative:
      'A rich seam is found outside the capital. Fresh supply reaches the market and weighs on old iron.',
  },
  'granary-fire': {
    title: 'The Granary Fire',
    narrative:
      'The royal granary burns before dawn. Grain grows scarce as the city prepares for hunger.',
  },
  'noble-gem-fever': {
    title: 'Noble Gem Fever',
    narrative:
      'Rumor says the new throne will be paved with gems. The court begins to hoard every stone it can find.',
  },
  'coronation-cancelled': {
    title: 'The Coronation Falls',
    narrative:
      'The crown is lost in a palace coup. The gem frenzy ends as quickly as it began.',
  },
  'barbarian-siege': {
    title: 'The City Under Siege',
    narrative:
      'Supply lines are severed. Grain becomes survival; jewels can no longer buy a loaf of bread.',
  },
  'peace-rumor': {
    title: 'Rumors of Peace',
    narrative:
      'Three princes may lower their banners. War goods cool while the court remembers luxury.',
  },
  'merchant-caravan': {
    title: 'The Southern Caravan',
    narrative:
      'Merchants break through the blockade with grain and gems, briefly easing the city market.',
  },
  'royal-wedding': {
    title: 'A Royal Wedding',
    narrative:
      'A sudden marriage fills the roads with nobles seeking gems and warhorses for the celebration.',
  },
  'stable-plague': {
    title: 'Plague in the Stables',
    narrative:
      'The royal stables close their gates. Warhorse trading freezes and final valuations fall.',
  },
};

const EVENT_LABELS: Record<string, { title: string; description: string }> = {
  'game.created': {
    title: 'The table was opened',
    description: 'Rules, schedule commitment, and seats were sealed.',
  },
  'participant.joined': {
    title: 'An Agent entered the Pawnhouse',
    description: 'Its game configuration is now frozen.',
  },
  'round.started': {
    title: 'The market bell rang',
    description: 'A new round is accepting Agent decisions.',
  },
  'world.event_revealed': {
    title: 'A royal bulletin was posted',
    description: 'Every Agent received the same public market event.',
  },
  'runtime.run_queued': {
    title: 'An Agent was summoned',
    description: 'Arena queued an isolated decision run.',
  },
  'decision.applied': {
    title: 'An order reached the ledger',
    description: 'Arena validated and applied a buy, sell, or pass decision.',
  },
  'pairing.created': {
    title: 'Two orders met in the queue',
    description: 'A buyer and seller were paired by Arena receive time.',
  },
  'negotiation.message': {
    title: 'A new offer crossed the table',
    description: 'The bargaining contract recorded a propose, accept, or reject action.',
  },
  'settlement.intent_frozen': {
    title: 'Price agreed · awaiting settlement',
    description: 'The accepted terms are frozen, but the trade is not complete.',
  },
  'settlement.approved': {
    title: 'Payment authorization approved',
    description: 'The settlement may now be submitted to the network.',
  },
  'settlement.submitted': {
    title: 'Payment submitted',
    description: 'Arena is waiting for a chain confirmation.',
  },
  'settlement.chain_confirmed': {
    title: 'Confirmed on-chain · updating ledger',
    description: 'Payment is final; Arena still has to commit the inventory transfer.',
  },
  'settlement.inventory_committed': {
    title: 'Trade complete',
    description: 'Payment and inventory are both final.',
  },
  'settlement.confirmation_timeout': {
    title: 'Settlement timed out',
    description: 'No chain confirmation arrived before the deadline.',
  },
  'settlement.reverted': {
    title: 'Settlement reverted',
    description: 'Arena kept the inventory unchanged.',
  },
  'round.closed': {
    title: 'The round ledger closed',
    description: 'The market advanced using only committed trades.',
  },
  'game.completed': {
    title: 'The final ledger was sealed',
    description: 'Final prices were frozen and ranks were calculated.',
  },
};

function pick(record: RecordValue | undefined, ...keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function containsHan(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
}

function publicText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  if (!clean || containsHan(clean)) return fallback;
  return clean.slice(0, 180);
}

function shortAgent(value: unknown, fallback = 'Unknown Agent'): string {
  const raw = publicText(value, fallback).replace(/^agent[_:-]?/i, '');
  return raw
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, 28);
}

function atomicGold(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const gold = numeric / 1_000_000;
  return gold.toLocaleString('en-US', {
    minimumFractionDigits: gold % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function eventAgent(data: RecordValue): string {
  return shortAgent(
    pick(
      data,
      'agentId',
      'agent_id',
      'actorAgentId',
      'actor_agent_id',
      'buyerAgentId',
      'buyer_agent_id',
    ),
    'An Agent',
  );
}

function currentRoundPhase(state: PawnhouseGameState | null): MarketPhase {
  const gamePhase = String(state?.phase || '').toLowerCase();
  if (gamePhase === 'completed') return 'closed';
  if (gamePhase === 'registration') return 'omen';

  const round = Number(state?.currentRound || 0);
  const rows = Array.isArray(state?.rounds) ? state.rounds : [];
  const current = rows.find(
    (row) => Number(pick(row, 'roundIndex', 'round_index')) === round,
  );
  const raw = String(pick(current, 'phase') || gamePhase).toLowerCase();
  if (raw.includes('decision') || raw === 'decide') return 'decide';
  if (raw.includes('pair') || raw.includes('pool')) return 'queue';
  if (raw.includes('negotiat')) return 'bargain';
  if (raw.includes('settle')) return 'seal';
  if (raw.includes('close') || raw.includes('complete')) return 'closed';
  return 'omen';
}

function replayPhase(events: PawnhouseTimelineEvent[]): MarketPhase {
  const latest = events.at(-1)?.type || '';
  if (latest === 'game.completed' || latest === 'round.closed') return 'closed';
  if (latest.startsWith('settlement.')) return 'seal';
  if (latest === 'negotiation.message') return 'bargain';
  if (latest.startsWith('pairing.') || latest === 'order.queued') return 'queue';
  if (latest === 'decision.applied' || latest.startsWith('runtime.')) return 'decide';
  return 'omen';
}

function worldBulletin(events: PawnhouseTimelineEvent[]) {
  const event = [...events].reverse().find((item) => item.type === 'world.event_revealed');
  const id = publicText(pick(event?.data, 'eventId', 'event_id'), '');
  return (
    WORLD_EVENTS[id] || {
      title: 'A New Royal Bulletin',
      narrative:
        'A public market event has been revealed. The exact effect is recorded in the Arena ledger.',
    }
  );
}

function eventDescription(event: PawnhouseTimelineEvent): string {
  const data = event.data || {};
  const agent = eventAgent(data);
  const good = publicText(pick(data, 'goodId', 'good_id', 'good'), '').toUpperCase();
  const action = publicText(pick(data, 'action'), '').toUpperCase();

  if (event.type === 'decision.applied') {
    return `${agent} entered ${action || 'AN ORDER'}${good ? ` · ${good}` : ''}.`;
  }
  if (event.type === 'pairing.created') {
    const buyer = shortAgent(pick(data, 'buyerAgentId', 'buyer_agent_id'), 'Buyer');
    const seller = shortAgent(pick(data, 'sellerAgentId', 'seller_agent_id'), 'Seller');
    return `${buyer} met ${seller}${good ? ` across the ${good} table` : ''}.`;
  }
  if (event.type === 'negotiation.message') {
    const price = atomicGold(pick(data, 'priceAtomic', 'price_atomic', 'price'));
    return `${agent} submitted ${action || 'A RESPONSE'}${price ? ` at ${price} gold` : ''}.`;
  }
  return EVENT_LABELS[event.type]?.description || 'A public Arena event was recorded.';
}

function eventTime(event: PawnhouseTimelineEvent): string {
  if (!event.occurredAt) return `#${String(event.sequence).padStart(3, '0')}`;
  const date = new Date(event.occurredAt);
  if (Number.isNaN(date.getTime())) return `#${String(event.sequence).padStart(3, '0')}`;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function pairingRows(events: PawnhouseTimelineEvent[]) {
  const activeIds = new Set(activePairingIds(events));
  return events
    .filter((event) => event.type === 'pairing.created')
    .slice(-4)
    .reverse()
    .map((event) => {
      const data = event.data;
      const buyerId = String(
        pick(
          data,
          'buyerAgentId',
          'buyer_agent_id',
          'buyerParticipantId',
          'buyer_participant_id',
        ) || '',
      );
      const sellerId = String(
        pick(
          data,
          'sellerAgentId',
          'seller_agent_id',
          'sellerParticipantId',
          'seller_participant_id',
        ) || '',
      );
      return {
        id: publicText(
          pick(data, 'pairingId', 'pairing_id'),
          `pair-${event.sequence}`,
        ),
        buyerId,
        sellerId,
        buyer: shortAgent(buyerId, 'Buyer'),
        seller: shortAgent(sellerId, 'Seller'),
        good: publicText(pick(data, 'goodId', 'good_id', 'good'), 'goods').toUpperCase(),
        active: activeIds.has(
          publicText(
            pick(data, 'pairingId', 'pairing_id'),
            `pair-${event.sequence}`,
          ),
        ),
      };
    });
}

function agentRows(state: PawnhouseGameState | null, events: PawnhouseTimelineEvent[]) {
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  return participants.map((participant, index) => {
    const id = pick(participant, 'agentId', 'agent_id');
    const rawId = String(id || '');
    const lastDecision = [...events]
      .reverse()
      .find(
        (event) =>
          event.type === 'decision.applied' &&
          String(pick(event.data, 'agentId', 'agent_id')) === rawId,
      );
    return {
      participantId: publicText(
        pick(participant, 'participantId', 'participant_id', 'gameParticipantId', 'game_participant_id'),
        '',
      ),
      agentId: rawId,
      name: shortAgent(id, `Agent ${String(index + 1).padStart(2, '0')}`),
      kind: publicText(pick(participant, 'runtimeKind', 'runtime_kind'), 'agent'),
      status: publicText(pick(participant, 'status'), 'waiting').toUpperCase(),
      readiness: publicText(
        pick(participant, 'readiness'),
        '',
      ).toUpperCase(),
      action: publicText(pick(lastDecision?.data, 'action'), 'waiting').toUpperCase(),
      active: Boolean(lastDecision),
      reputation: readAgentReputation(participant),
    };
  });
}

export default function GameViewer({ gameId }: { gameId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const demo = gameId === 'demo';
  const replayRequested = searchParams.get('replay') === '1';
  const [liveState, setLiveState] = useState<PawnhouseGameState | null>(null);
  const [liveEvents, setLiveEvents] = useState<PawnhouseTimelineEvent[]>([]);
  const [currentProjection, setCurrentProjection] = useState<CurrentGame | null>(null);
  const [error, setError] = useState('');
  const [feedDelayed, setFeedDelayed] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState('');
  const [leavingPool, setLeavingPool] = useState(false);
  const [replayEventCount, setReplayEventCount] = useState<number | null>(null);
  const [demoPlayback, setDemoPlayback] = useState<DemoPlaybackPosition>({
    roundIndex: 0,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  });

  useEffect(() => {
    if (!demo || replayRequested) return;
    const timer = window.setInterval(() => {
      setDemoPlayback((current) => advanceDemoPlayback(current));
    }, 1_900);
    return () => window.clearInterval(timer);
  }, [demo, replayRequested]);

  useEffect(() => {
    if (demo) return;
    let after = 0;
    let stopped = false;
    let hasSnapshot = false;

    async function refresh(signal?: AbortSignal) {
      try {
        const [nextState, timeline] = await Promise.all([
          getPawnhouseGame(gameId, signal),
          getPawnhouseTimeline(gameId, after, signal),
        ]);
        if (stopped) return;
        hasSnapshot = true;
        setLiveState(nextState);
        void getCurrentGame(signal)
          .then((response) => {
            if (!stopped && response.game.gameId === gameId) {
              setCurrentProjection(response.game);
            }
          })
          .catch(() => {
            // Older and completed tables are not required to be current.
          });
        if (timeline.events.length > 0) {
          after = timeline.nextAfter;
          setLiveEvents((current) => {
            const merged = [...current, ...timeline.events];
            return merged.filter(
              (event, index, rows) =>
                rows.findIndex((candidate) => candidate.sequence === event.sequence) ===
                index,
            );
          });
        }
        setError('');
        setFeedDelayed(false);
      } catch (cause) {
        if (!stopped && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setFeedDelayed(hasSnapshot);
          setError(hasSnapshot ? '' : 'This table is not available from the public Arena API.');
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
  }, [demo, gameId]);

  useEffect(() => {
    if (demo) return;
    setMyParticipantId(
      window.localStorage.getItem(`arena402:participant:${gameId}`) || '',
    );
  }, [demo, gameId]);

  const demoRound = DEMO_ROUNDS[demoPlayback.roundIndex] || DEMO_ROUNDS[0];
  const demoEvents = demoRound.events.slice(0, demoPlayback.eventCount);
  const state = demo ? buildDemoGameState(demoRound, demoEvents) : liveState;
  const sourceEvents = demo && replayRequested
    ? DEMO_ROUNDS.flatMap((round) => round.events)
    : demo
      ? demoEvents
      : liveEvents;
  const events =
    replayRequested && replayEventCount !== null
      ? sourceEvents.slice(0, replayEventCount)
      : sourceEvents;

  useEffect(() => {
    if (!replayRequested || sourceEvents.length === 0) {
      setReplayEventCount(null);
      return;
    }
    setReplayEventCount((current) =>
      current === null ? 1 : Math.min(current, sourceEvents.length),
    );
  }, [replayRequested, sourceEvents.length]);

  useEffect(() => {
    if (
      !replayRequested
      || replayEventCount === null
      || replayEventCount >= sourceEvents.length
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => setReplayEventCount((current) => (current || 0) + 1),
      650,
    );
    return () => window.clearTimeout(timer);
  }, [replayEventCount, replayRequested, sourceEvents.length]);
  const phase = replayRequested ? replayPhase(events) : currentRoundPhase(state);
  const bulletin = useMemo(() => worldBulletin(events), [events]);
  const pairs = useMemo(() => pairingRows(events), [events]);
  const agents = useMemo(() => agentRows(state, events), [state, events]);
  const trades = useMemo(() => buildLedgerTrades(events), [events]);
  const replayRound = [...events]
    .reverse()
    .find((event) => event.type === 'round.started');
  const currentRound = replayRequested
    ? Number(
        replayRound?.data.round
        ?? replayRound?.data.roundIndex
        ?? replayRound?.data.round_index
        ?? 0,
      )
    : Number(state?.currentRound || 0);
  const viewState =
    replayRequested && state
      ? {
          ...state,
          phase: events.at(-1)?.type === 'game.completed' ? 'completed' : 'running',
          currentRound,
          priceSnapshots: Array.isArray(state.priceSnapshots)
            ? visibleReplaySnapshots(
                state.priceSnapshots.filter(
                  (snapshot): snapshot is Record<string, unknown> =>
                    Boolean(snapshot) && typeof snapshot === 'object',
                ),
                events,
              )
            : state.priceSnapshots,
        }
      : state;
  const totalRounds = Number(state?.roundCount || state?.totalRounds || 0);
  const isComplete = String(state?.phase || '').toLowerCase() === 'completed';
  const latestEvent = events[events.length - 1];
  const registrationOpen = ['registration', 'portfolio_setup'].includes(
    String(state?.phase || '').toLowerCase(),
  );
  const myAgent = myParticipantId
    ? agents.find((agent) => agent.participantId === myParticipantId)
    : undefined;
  const currentPair = pairs.find((pair) => pair.active);

  async function leavePool() {
    if (!myParticipantId || !registrationOpen || leavingPool) return;
    if (!window.confirm('Leave this pool and revoke the unused game mandate?')) {
      return;
    }
    setLeavingPool(true);
    setError('');
    try {
      await withdrawCurrentGameParticipant(
        gameId,
        myParticipantId,
        `web-withdraw:${crypto.randomUUID()}`,
      );
      window.localStorage.removeItem(`arena402:participant:${gameId}`);
      router.push('/game');
    } catch {
      setError('Arena could not withdraw this seat. The pool remains unchanged.');
      setLeavingPool(false);
    }
  }

  return (
    <section className="gm gm-live">
      <div className="gm-utility-row">
        <Link className="back-btn" href="/game">
          ← The Pawnhouse Gate
        </Link>
        <div className="gm-live-mark">
          <span className="gm-live-dot" aria-hidden="true" />
          {isComplete
            ? 'Ledger closed'
            : demo
              ? 'Scripted live demo'
              : feedDelayed
                ? 'Feed delayed · last safe snapshot'
                : 'Public live feed'}
        </div>
      </div>

      {demo && <MarketPriceTicker />}

      <header className="gm-live-head">
        <div>
          <p className="label">
            {locale === 'zh-CN' ? '对局' : 'Game'}{' '}
            {publicText(gameId, 'Private table')} ·{' '}
            {locale === 'zh-CN' ? '王家典当行' : 'King’s Pawnhouse'}
          </p>
          <h1 className="display">
            {locale === 'zh-CN' ? '第 ' : 'Round '}
            {String(currentRound).padStart(2, '0')}
            {locale === 'zh-CN' ? ' 回合' : ''}
            <span> / {String(totalRounds).padStart(2, '0')}</span>
          </h1>
        </div>
        <div className="gm-head-status">
          <p className="label">Now in session</p>
          <p>{PHASES.find((item) => item.id === phase)?.label || 'Ledger closed'}</p>
        </div>
      </header>

      <nav className="gm-view-sections" aria-label="Game sections">
        <a href="#pool">Pool</a>
        <a href="#market">Market</a>
        <a href="#ledger">Ledger</a>
      </nav>

      {replayRequested && (
        <div className="gm-replay-control" role="status">
          <span className="label">Match replay</span>
          <p>
            Event {replayEventCount || 0} / {sourceEvents.length}
          </p>
          <button
            type="button"
            className="gm-text-link"
            onClick={() => setReplayEventCount(1)}
          >
            Replay from opening bell
          </button>
        </div>
      )}

      <section className="gm-participant-pool" id="pool" aria-labelledby="pool-title">
        <div className="gm-section-heading">
          <div>
            <p className="label">Sealed seats · Current game</p>
            <h2 className="display" id="pool-title">
              {registrationOpen ? 'The pool is forming.' : 'The pool is locked.'}
            </h2>
          </div>
          <p>
            {currentProjection
              ? `${currentProjection.readyCount} of ${currentProjection.startThreshold} ready · ${currentProjection.maxParticipants} seats maximum`
              : `${agents.length} public seat${agents.length === 1 ? '' : 's'} · threshold awaiting current projection`}
          </p>
        </div>
        <div className="gm-pool-seats">
          {agents.length > 0 ? (
            agents.map((agent, index) => {
              const currentSeat = currentProjection?.participants.find(
                (participant) => participant.agentId === agent.agentId,
              );
              const readiness = currentSeat?.readiness || agent.readiness;
              const publicStatus = agent.status;
              const seatState =
                readiness === 'WITHDRAWN'
                || ['CANCELLED', 'WITHDRAWN'].includes(publicStatus)
                  ? 'WITHDRAWN'
                  : registrationOpen
                    ? readiness || 'PENDING'
                    : publicStatus === 'COMPLETED'
                      ? 'COMPLETED'
                      : publicStatus === 'ACTIVE'
                        ? 'ACTIVE'
                        : publicStatus || 'LOCKED';
              return (
                <article
                  id={agent.participantId ? `participant-${agent.participantId}` : undefined}
                  className={
                    myParticipantId && agent.participantId === myParticipantId
                      ? 'is-mine'
                      : ''
                  }
                  key={agent.participantId || `${agent.agentId}-${index}`}
                >
                  <span className="gm-pool-seat-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="gm-pool-seat-agent">
                    <span className="label">{agent.kind}</span>
                    <strong>{currentSeat?.displayName || agent.name}</strong>
                    {myParticipantId && agent.participantId === myParticipantId
                      ? <small>Your sealed Agent</small>
                      : null}
                  </div>
                  <AgentReputationCard
                    reputation={currentSeat?.reputation || agent.reputation}
                    compact
                  />
                  <b>{seatState}</b>
                </article>
              );
            })
          ) : (
            <p className="empty">Waiting for the first sealed seat</p>
          )}
        </div>
        <div className="gm-pool-actions">
          {currentProjection?.joinedByMe && !myParticipantId && (
            <p className="gm-owner-control-note">
              Arena confirms your seat, but the current owner projection does not
              expose its participant ID. Owner controls stay hidden.
            </p>
          )}
          {registrationOpen
            && currentProjection?.joinedByMe
            && myParticipantId
            && (
            <button
              type="button"
              className="gm-text-link"
              disabled={leavingPool}
              onClick={() => void leavePool()}
            >
              {leavingPool ? 'Leaving pool…' : 'Leave pool'}
            </button>
          )}
          {!registrationOpen
            && currentProjection?.joinedByMe
            && myAgent
            && (
            <a
              className="btn gm-primary-action"
              href={`#agent-${myAgent.participantId}`}
            >
              Follow my Agent
            </a>
          )}
        </div>
      </section>

      <nav className="gm-ritual-rail" aria-label="Round progress">
        {PHASES.map((item, index) => {
          const activeIndex = PHASES.findIndex((phaseItem) => phaseItem.id === phase);
          const complete = phase === 'closed' || index < activeIndex;
          return (
            <div
              className={`gm-ritual-step ${
                item.id === phase ? 'is-active' : complete ? 'is-complete' : ''
              }`}
              key={item.id}
              aria-current={item.id === phase ? 'step' : undefined}
            >
              <span>{item.roman}</span>
              <strong>{item.label}</strong>
            </div>
          );
        })}
      </nav>

      {error && <p className="data-state error">{error}</p>}

      <section className="gm-bulletin" id="market">
        <div className="gm-bulletin-art" aria-hidden="true" />
        <div className="gm-bulletin-copy">
          <div className="gm-pin" aria-hidden="true" />
          <p className="label">
            {locale === 'zh-CN' ? '王室公告 · 第 ' : 'Royal bulletin · Round '}
            {currentRound}
            {locale === 'zh-CN' ? ' 回合' : ''}
          </p>
          <h2>{bulletin.title}</h2>
          <p>{bulletin.narrative}</p>
          <div className="gm-bulletin-stamp">PUBLIC SIGNAL</div>
        </div>
      </section>

      <div className="gm-live-layout">
        <main className="gm-market-stage">
          <div className="gm-stage-head">
            <div>
              <p className="label">The market floor</p>
              <h2 className="display">
                {phase === 'decide'
                  ? 'Orders enter.'
                  : phase === 'queue'
                    ? 'The queue meets.'
                    : phase === 'bargain'
                      ? 'Terms cross the table.'
                      : phase === 'seal'
                        ? 'The ledger waits.'
                        : phase === 'closed'
                          ? 'The ledger is sealed.'
                          : 'The omen arrives.'}
              </h2>
            </div>
            <span className="gm-stage-index label">
              {String(demo ? events.length : latestEvent?.sequence || 0).padStart(
                3,
                '0',
              )}{' '}
              events
            </span>
          </div>

          <section className="gm-queue" aria-labelledby="market-price-title">
            <MarketIntelligence state={viewState} events={events} />
          </section>

          <section className="gm-queue" aria-labelledby="queue-title">
            <MatchmakingPool state={viewState} events={events} />
            <div className="gm-panel-head">
              <p className="label" id="queue-title">
                FCFS pairing rail
              </p>
              <p>Ordered by Arena receive time</p>
            </div>
            {pairs.length > 0 ? (
              <div className="gm-pair-list">
                {pairs.map((pair) => {
                  const buyer = agents.find(
                    (agent) =>
                      agent.agentId === pair.buyerId
                      || agent.participantId === pair.buyerId,
                  );
                  const seller = agents.find(
                    (agent) =>
                      agent.agentId === pair.sellerId
                      || agent.participantId === pair.sellerId,
                  );
                  return (
                    <article className={`gm-pair-card ${pair.active ? 'is-live' : ''}`} key={pair.id}>
                      <div>
                        <span className="label">Buyer</span>
                        <strong>{pair.buyer}</strong>
                        <AgentReputationCard reputation={buyer?.reputation} compact />
                      </div>
                      <div className="gm-pair-collision" aria-label={`Trading ${pair.good}`}>
                        <span />
                        <b>{pair.good}</b>
                        <span />
                      </div>
                      <div>
                        <span className="label">Seller</span>
                        <strong>{pair.seller}</strong>
                        <AgentReputationCard reputation={seller?.reputation} compact />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="gm-waiting-board">
                <span className="gm-waiting-mark" aria-hidden="true">
                  ◇
                </span>
                <p>No compatible orders have met yet.</p>
                <span className="label">The queue remains open</span>
              </div>
            )}
          </section>

          <section className="gm-bargain" aria-labelledby="bargain-title">
            <div className="gm-panel-head">
              <p className="label" id="bargain-title">
                Bargaining chamber
              </p>
              <p>Buyer speaks first · Three turns maximum</p>
            </div>
            {currentPair ? (
              <NegotiationTerminal
                events={events}
                pairingId={currentPair.id}
                onReplay={
                  demo
                    ? () =>
                        setDemoPlayback({
                          roundIndex: 0,
                          eventCount: DEMO_INITIAL_EVENT_COUNT,
                        })
                    : undefined
                }
              />
            ) : (
              <div className="gm-waiting-board">
                <span className="gm-waiting-mark" aria-hidden="true">
                  II
                </span>
                <p>The bargaining chamber is quiet.</p>
                <span className="label">Waiting for a pairing</span>
              </div>
            )}
          </section>

          <SettlementRail events={events} pairing={pairs[0]?.id} />
        </main>

        <aside className="gm-side-ledger">
          <section className="gm-agent-board">
            <div className="gm-panel-head">
              <p className="label">Agents at the table</p>
              <p>{agents.length} sealed seats</p>
            </div>
            <div>
              {agents.length > 0 ? (
                agents.map((agent, index) => (
                  <div
                    id={agent.participantId ? `agent-${agent.participantId}` : undefined}
                    className={`gm-agent-row ${agent.active ? 'is-active' : ''}`}
                    key={`${agent.name}-${index}`}
                  >
                    <span className="gm-agent-rank">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.kind.toUpperCase()}</span>
                      <AgentReputationCard reputation={agent.reputation} compact />
                    </div>
                    <b>{agent.action}</b>
                  </div>
                ))
              ) : (
                <p className="empty">Waiting for public participants</p>
              )}
            </div>
          </section>

          <section className="gm-chronicle">
            <div className="gm-panel-head">
              <p className="label">Live chronicle</p>
              <p>Public events only</p>
            </div>
            <div className="gm-chronicle-list" aria-live="polite">
              {[...events]
                .reverse()
                .slice(0, 8)
                .map((event) => (
                  <article key={event.sequence}>
                    <time>{eventTime(event)}</time>
                    <div>
                      <strong>
                        {EVENT_LABELS[event.type]?.title || 'Arena event recorded'}
                      </strong>
                      <p>{eventDescription(event)}</p>
                    </div>
                  </article>
                ))}
              {events.length === 0 && <p className="empty">Waiting for Arena events</p>}
            </div>
          </section>
        </aside>
      </div>

      <section className="gm-game-ledger" id="ledger" aria-labelledby="game-ledger-title">
        <div className="gm-section-heading">
          <div>
            <p className="label">Committed settlement ledger</p>
            <h2 className="display" id="game-ledger-title">The ledger remembers.</h2>
          </div>
          <p>
            Only inventory committed rows are completed trades. Chain confirmation
            alone remains pending.
          </p>
        </div>
        <div className="gm-game-ledger-rows">
          {trades.length > 0 ? (
            trades.map((trade) => (
              <article key={trade.pairingId}>
                <span>R{String(trade.round || 0).padStart(2, '0')}</span>
                <div>
                  <strong>{trade.buyer} → {trade.seller}</strong>
                  <small>{trade.goodId.toUpperCase()} · QTY {trade.quantity}</small>
                </div>
                <p>
                  {formatGold(
                    trade.amountAtomic
                      ?? (trade.priceAtomic !== null
                        ? trade.priceAtomic * trade.quantity
                        : null),
                  )}{' '}
                  <small>GOLD</small>
                </p>
                <b className={`is-${trade.status}`}>
                  {trade.status === 'committed'
                    ? 'INVENTORY COMMITTED'
                    : trade.status === 'confirmed'
                      ? 'CHAIN CONFIRMED'
                      : trade.status === 'failed'
                        ? 'NO DEAL'
                        : 'SETTLING'}
                </b>
                <details>
                  <summary>Inspect settlement</summary>
                  <p>
                    {trade.status === 'failed'
                      ? 'Settlement closed without an inventory change.'
                      : `Stage ${trade.stageReached + 1} of 5 recorded by Arena.`}
                  </p>
                </details>
              </article>
            ))
          ) : (
            <p className="empty">No settlement has reached the public ledger.</p>
          )}
        </div>
      </section>

      <section className={`gm-audit ${auditOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="gm-audit-toggle"
          aria-expanded={auditOpen}
          onClick={() => setAuditOpen((open) => !open)}
        >
          <span>
            <span className="label">Arena proof drawer</span>
            <strong>Inspect the immutable public trail</strong>
          </span>
          <span aria-hidden="true">{auditOpen ? '−' : '+'}</span>
        </button>
        {auditOpen && (
          <div className="gm-audit-body">
            <dl>
              <div>
                <dt>Schema</dt>
                <dd>{publicText(state?.schemaVersion, 'arena.pawnhouse-game-state.v1')}</dd>
              </div>
              <div>
                <dt>Schedule commitment</dt>
                <dd>
                  {publicText(state?.eventScheduleCommitment, 'Revealed by Arena at game close')}
                </dd>
              </div>
              <div>
                <dt>Last sequence</dt>
                <dd>#{String(latestEvent?.sequence || 0).padStart(3, '0')}</dd>
              </div>
            </dl>
            <div className="gm-audit-events">
              {events.slice(-12).map((event) => (
                <div key={event.sequence}>
                  <code>#{String(event.sequence).padStart(3, '0')}</code>
                  <span>{event.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {isComplete && (
        <Link className="btn gm-result-link" href={`/game/${encodeURIComponent(gameId)}/result`}>
          Open the final ledger →
        </Link>
      )}
    </section>
  );
}
