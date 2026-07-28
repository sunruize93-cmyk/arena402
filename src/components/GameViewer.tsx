'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AgentReputationCard from '@/components/AgentReputationCard';
import MarketIntelligence from '@/components/MarketIntelligence';
import MarketHistoryBoard from '@/components/MarketHistoryBoard';
import MatchmakingPool from '@/components/MatchmakingPool';
import NegotiationTerminal from '@/components/NegotiationTerminal';
import SettlementRail from '@/components/SettlementRail';
import { useLocale } from '@/components/LocaleProvider';
import { translateText } from '@/lib/i18n';
import {
  advanceDemoPlayback,
  buildDemoGameState,
  DEMO_INITIAL_EVENT_COUNT,
  DEMO_ROUNDS,
} from '@/lib/game-demo';
import type { DemoPlaybackPosition } from '@/lib/game-demo';
import {
  getPawnhouseEventsUrl,
  getPawnhouseGame,
  getPawnhouseTimeline,
  getCurrentGame,
  CurrentGame,
  PawnhouseGameState,
  PawnhouseTimelineEvent,
  withdrawCurrentGameParticipant,
} from '@/lib/game-api';
import { rankingAgentIdentity } from '@/lib/game-display';
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

function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function pairingRows(
  events: PawnhouseTimelineEvent[],
  state: PawnhouseGameState | null,
) {
  const activeIds = new Set(activePairingIds(events));
  const pairingStatuses = new Map<string, string>();
  const snapshotPairings = Array.isArray(state?.pairings) ? state.pairings : [];
  snapshotPairings.forEach((pairing) => {
    const id = String(pick(pairing, 'pairingId', 'pairing_id') || '');
    const status = String(pick(pairing, 'status') || '').toLowerCase();
    if (id && status) pairingStatuses.set(id, status);
  });
  const participantNames = new Map<string, string>();
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  participants.forEach((participant, index) => {
    const identity = rankingAgentIdentity(participant, index);
    const participantId = String(
      pick(
        participant,
        'participantId',
        'participant_id',
        'gameParticipantId',
        'game_participant_id',
      ) || '',
    );
    if (participantId) participantNames.set(participantId, identity.displayName);
    if (identity.agentId) {
      participantNames.set(identity.agentId, identity.displayName);
    }
  });
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
      const id = publicText(
        pick(data, 'pairingId', 'pairing_id'),
        `pair-${event.sequence}`,
      );
      const status = pairingStatuses.get(id) || '';
      return {
        id,
        status,
        roundId: String(event.roundId || pick(data, 'roundId', 'round_id') || ''),
        roundIndex: Number(pick(data, 'round', 'roundIndex', 'round_index') || 0),
        buyerId,
        sellerId,
        buyer: participantNames.get(buyerId) || shortAgent(buyerId, 'Buyer'),
        seller: participantNames.get(sellerId) || shortAgent(sellerId, 'Seller'),
        good: publicText(pick(data, 'goodId', 'good_id', 'good'), 'goods').toUpperCase(),
        active:
          activeIds.has(id)
          && !['rejected', 'timeout', 'settled', 'settlement_failed'].includes(status),
      };
    });
}

function agentRows(state: PawnhouseGameState | null, events: PawnhouseTimelineEvent[]) {
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  return participants.map((participant, index) => {
    const id = pick(participant, 'agentId', 'agent_id');
    const rawId = String(id || '');
    const identity = rankingAgentIdentity(participant, index);
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
      name: identity.displayName,
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
  const [currentGame, setCurrentGame] = useState<CurrentGame | null>(null);
  const [liveEvents, setLiveEvents] = useState<PawnhouseTimelineEvent[]>([]);
  const [currentProjection, setCurrentProjection] = useState<CurrentGame | null>(null);
  const [error, setError] = useState('');
  const [feedDelayed, setFeedDelayed] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [marketPanel, setMarketPanel] = useState<'prices' | 'orders'>('prices');
  const [inspectorPanel, setInspectorPanel] = useState<'agents' | 'events' | 'ledger'>(
    'events',
  );
  const [myParticipantId, setMyParticipantId] = useState('');
  const [leavingPool, setLeavingPool] = useState(false);
  const [replayEventCount, setReplayEventCount] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [demoPlayback, setDemoPlayback] = useState<DemoPlaybackPosition>({
    roundIndex: 0,
    eventCount: DEMO_INITIAL_EVENT_COUNT,
  });

  useEffect(() => {
    setLiveState(null);
    setCurrentGame(null);
    setLiveEvents([]);
    setCurrentProjection(null);
    setMyParticipantId('');
    setError('');
    setFeedDelayed(false);
    setReplayEventCount(null);
  }, [gameId]);

  useEffect(() => {
    if (!demo || replayRequested) return;
    const timer = window.setInterval(() => {
      setDemoPlayback((current) => advanceDemoPlayback(current));
    }, 1_900);
    return () => window.clearInterval(timer);
  }, [demo, replayRequested]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (demo) return;
    let after = 0;
    let stopped = false;
    let hasSnapshot = false;
    let fallbackTimer: number | undefined;
    let staleWatchTimer: number | undefined;
    let stateRefreshTimer: number | undefined;
    let eventSource: EventSource | undefined;
    let lastEventAt = Date.now();
    let gameTerminal = false;
    const controller = new AbortController();

    function mergeEvents(events: PawnhouseTimelineEvent[], nextAfter?: number) {
      if (events.length === 0 || stopped) return;
      after = Math.max(
        after,
        nextAfter || 0,
        ...events.map((event) => Number(event.sequence) || 0),
      );
      setLiveEvents((current) => {
        const merged = [...current, ...events];
        return merged
          .filter(
            (event, index, rows) =>
              rows.findIndex((candidate) => candidate.sequence === event.sequence) ===
              index,
          )
          .sort((left, right) => left.sequence - right.sequence)
          .slice(-1_000);
      });
      lastEventAt = Date.now();
    }

    async function refreshState(signal?: AbortSignal) {
      try {
        const [nextState, current] = await Promise.all([
          getPawnhouseGame(gameId, signal),
          getCurrentGame(signal).catch(() => null),
        ]);
        if (stopped) return;
        hasSnapshot = true;
        gameTerminal = String(nextState.phase || '').toLowerCase() === 'completed';
        setLiveState(nextState);
        setCurrentGame(
          current?.game.gameId === gameId ? current.game : null,
        );
        if (current?.game.gameId === gameId) {
          setCurrentProjection(current.game);
        } else {
          setCurrentProjection(null);
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

    async function refreshAll(signal?: AbortSignal) {
      try {
        const [nextState, timeline, current] = await Promise.all([
          getPawnhouseGame(gameId, signal),
          getPawnhouseTimeline(gameId, after, signal),
          getCurrentGame(signal).catch(() => null),
        ]);
        if (stopped) return;
        setLiveState(nextState);
        hasSnapshot = true;
        gameTerminal = String(nextState.phase || '').toLowerCase() === 'completed';
        setCurrentGame(
          current?.game.gameId === gameId ? current.game : null,
        );
        if (current?.game.gameId === gameId) {
          setCurrentProjection(current.game);
        } else {
          setCurrentProjection(null);
        }
        mergeEvents(timeline.events, timeline.nextAfter);
        setError('');
        setFeedDelayed(false);
      } catch (cause) {
        if (!stopped && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError('This table is not available from the public Arena API.');
        }
      }
    }

    function startFallback() {
      if (fallbackTimer !== undefined || stopped) return;
      fallbackTimer = window.setInterval(() => void refreshAll(), 3_000);
    }

    function stopFallback() {
      if (fallbackTimer === undefined) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    }

    function startStaleWatch() {
      if (staleWatchTimer !== undefined || stopped) return;
      staleWatchTimer = window.setInterval(() => {
        if (gameTerminal || Date.now() - lastEventAt < 5_000) return;
        setFeedDelayed(true);
        void refreshAll();
      }, 3_000);
    }

    void refreshAll(controller.signal).then(() => {
      if (stopped) return;
      if (typeof EventSource === 'undefined') {
        startFallback();
        return;
      }

      eventSource = new EventSource(getPawnhouseEventsUrl(gameId, after));
      eventSource.onopen = () => {
        lastEventAt = Date.now();
        stopFallback();
      };
      eventSource.onerror = startFallback;
      startStaleWatch();
      eventSource.addEventListener('arena', (message) => {
        try {
          const event = JSON.parse(message.data) as PawnhouseTimelineEvent;
          if (
            !event ||
            !Number.isFinite(Number(event.sequence)) ||
            typeof event.type !== 'string' ||
            typeof event.data !== 'object'
          ) {
            return;
          }
          mergeEvents([event]);
          if (stateRefreshTimer !== undefined) {
            window.clearTimeout(stateRefreshTimer);
          }
          stateRefreshTimer = window.setTimeout(
            () => void refreshState(),
            250,
          );
        } catch {
          // Ignore malformed public projection records and keep the stream alive.
        }
      });
    });

    return () => {
      stopped = true;
      controller.abort();
      eventSource?.close();
      stopFallback();
      if (staleWatchTimer !== undefined) {
        window.clearInterval(staleWatchTimer);
      }
      if (stateRefreshTimer !== undefined) {
        window.clearTimeout(stateRefreshTimer);
      }
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
  const pairs = useMemo(() => pairingRows(events, state), [events, state]);
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
  const currentRoundState = Array.isArray(state?.rounds)
    ? state.rounds.find(
        (row) =>
          Boolean(row)
          && typeof row === 'object'
          && Number(pick(row as RecordValue, 'roundIndex', 'round_index')) ===
            currentRound,
      )
    : undefined;
  const rawDecisionDeadline =
    !demo && !replayRequested && phase === 'decide'
      ? pick(
          currentRoundState as RecordValue | undefined,
          'phaseDeadlineAt',
          'phase_deadline_at',
          'deadlineAt',
          'deadline_at',
        )
      : undefined;
  const decisionDeadlineAt =
    typeof rawDecisionDeadline === 'string'
      ? new Date(rawDecisionDeadline).getTime()
      : Number.NaN;
  const decisionRemaining = Number.isFinite(decisionDeadlineAt)
    ? decisionDeadlineAt - clock
    : null;
  const decisionCountdown =
    decisionRemaining === null
      ? null
      : decisionRemaining <= 0
        ? 'FINALIZING'
        : formatCountdown(decisionRemaining);
  const gamePhase = String(state?.phase || '').toLowerCase();
  const registrationOpen = ['registration', 'portfolio_setup'].includes(
    gamePhase,
  );
  const isRegistration = !demo && registrationOpen;
  const isComplete = gamePhase === 'completed';
  const latestEvent = events[events.length - 1];
  const myAgent = myParticipantId
    ? agents.find((agent) => agent.participantId === myParticipantId)
    : undefined;
  const currentPair = pairs.find((pair) => pair.active) || pairs[0];

  async function leavePool() {
    if (!myParticipantId || !registrationOpen || leavingPool) return;
    if (
      !window.confirm(
        translateText(
          'Leave this pool and revoke the unused game mandate?',
          locale,
        ),
      )
    ) {
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

  const readyCount = currentGame?.readyCount ?? agents.length;
  const startThreshold = currentGame?.startThreshold ?? 0;
  const seatsRemaining = Math.max(0, startThreshold - readyCount);
  const fillAt = currentGame?.matchmaking.fillAt;
  const fillRemaining = fillAt
    ? new Date(fillAt).getTime() - clock
    : null;
  const fillBlocked = currentGame?.matchmaking.fillStatus === 'BLOCKED';
  const matchingDelayed =
    fillBlocked
    || (
      Boolean(fillAt)
      && fillRemaining !== null
      && fillRemaining < -15_000
      && readyCount < startThreshold
    );
  const lobbyTitle = matchingDelayed
    ? 'Matchmaking needs attention.'
    : readyCount === 0
      ? 'Waiting for the first seat.'
      : currentGame?.matchmaking.fillStatus === 'FILLING'
        ? 'Official Agents are taking their seats.'
        : 'Seats are being assembled.';
  const lobbyDescription = matchingDelayed
    ? fillBlocked
      ? 'The Official Agent pool is unavailable. More human Agents may still join, but automatic fill cannot complete this table.'
      : 'The fill deadline has passed without enough ready Agents. Recheck the entry flow before waiting longer.'
    : readyCount === 0
      ? 'Matchmaking has not started. The first confirmed player starts the five-minute official-fill clock.'
      : currentGame?.joinedByMe
        ? `Your seat is confirmed. Arena is waiting for ${seatsRemaining} more ready ${
            seatsRemaining === 1 ? 'Agent' : 'Agents'
          }.`
        : `${readyCount} ready ${
            readyCount === 1 ? 'seat is' : 'seats are'
          } confirmed. Join from Play to enter this table.`;
  const fillLabel = fillBlocked
    ? 'Blocked'
    : matchingDelayed
      ? 'Delayed'
    : fillRemaining === null
      ? readyCount === 0
        ? 'After first seat'
        : 'Preparing'
      : fillRemaining <= 0
        ? 'Filling now'
        : formatCountdown(fillRemaining);
  const settlementState = [...events]
    .reverse()
    .find((event) => event.type.startsWith('settlement.'));

  return (
    <section className={`gm gm-live ${isRegistration ? 'is-registration' : 'is-battle'}`}>
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

      <header className={`gm-live-head ${isRegistration ? '' : 'is-compact'}`}>
        <div>
          <p className="label">
            {locale === 'zh-CN' ? '对局' : 'Game'}{' '}
            {publicText(gameId, 'Private table')} ·{' '}
            {locale === 'zh-CN' ? '王家典当行' : 'King’s Pawnhouse'}
          </p>
          <h1 className="display">
            {isRegistration ? (
              <>
                Waiting room
                <span> / {startThreshold || '—'}</span>
              </>
            ) : (
              <>
                {locale === 'zh-CN' ? '第 ' : 'Round '}
                {String(currentRound).padStart(2, '0')}
                {locale === 'zh-CN' ? ' 回合' : ''}
                <span> / {String(totalRounds).padStart(2, '0')}</span>
              </>
            )}
          </h1>
        </div>
        <div className="gm-head-status">
          <p className="label">
            {isRegistration ? 'Before the opening bell' : 'Now in session'}
          </p>
          <p>
            {isRegistration
              ? matchingDelayed
                ? 'Entry delayed'
                : 'Waiting to start'
              : PHASES.find((item) => item.id === phase)?.label || 'Ledger closed'}
          </p>
          {decisionCountdown && (
            <div
              className={`gm-decision-clock ${
                decisionRemaining !== null && decisionRemaining <= 0 ? 'is-finalizing' : ''
              }`}
              aria-live="polite"
            >
              <span>Decision window</span>
              <strong>{decisionCountdown}</strong>
            </div>
          )}
        </div>
      </header>

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

      {isRegistration && (
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
      )}

      {error && <p className="data-state error">{error}</p>}

      {isRegistration && (
        <section className="gm-lobby-board" aria-labelledby="lobby-title">
          <div className="gm-lobby-count" aria-label={`${readyCount} of ${startThreshold} ready`}>
            <div className="gm-lobby-ready">
              <span>{String(readyCount).padStart(2, '0')}</span>
              <small>/ {String(startThreshold || '—').padStart(2, '0')} READY</small>
            </div>
            <div
              className={`gm-lobby-clock ${matchingDelayed ? 'is-delayed' : ''}`}
              aria-live="polite"
            >
              <small>
                {fillRemaining === null ? 'Official fill status' : 'Official fill in'}
              </small>
              <strong>{fillLabel}</strong>
              <em>
                {startThreshold
                  ? (
                    <>
                      <span>Seats remaining</span> · {seatsRemaining}
                    </>
                  )
                  : 'Waiting for Arena threshold'}
              </em>
            </div>
          </div>
          <div className="gm-lobby-copy">
            <p className="label">
              {currentGame?.joinedByMe ? 'Your seat is confirmed' : 'Your seat is not confirmed'}
            </p>
            <h2 className="display" id="lobby-title">{lobbyTitle}</h2>
            <p>{lobbyDescription}</p>
            <div className="gm-lobby-actions">
              <Link className="btn" href="/play">
                {currentGame?.joinedByMe ? 'Review entry status' : 'Return to Play and join'}
              </Link>
              <span className="label">
                Live updates remain connected on this page
              </span>
            </div>
          </div>
          <dl className="gm-lobby-facts">
            <div>
              <dt>Ready seats</dt>
              <dd>{readyCount} / {startThreshold || '—'}</dd>
            </div>
            <div>
              <dt>Seats remaining</dt>
              <dd>{startThreshold ? seatsRemaining : '—'}</dd>
            </div>
            <div>
              <dt>Official fill</dt>
              <dd>{fillLabel}</dd>
            </div>
            <div>
              <dt>Match status</dt>
              <dd>{currentGame?.matchmaking.fillStatus || 'WAITING'}</dd>
            </div>
          </dl>
          <div className="gm-lobby-chronicle" aria-live="polite">
            <span className="label">Latest public record</span>
            <strong>{EVENT_LABELS[latestEvent?.type || '']?.title || 'The table is open'}</strong>
            <span>
              {locale === 'zh-CN'
                ? `${events.length} 条公开事件${
                    latestEvent ? ` · 最新事件 #${latestEvent.sequence}` : ''
                  }`
                : `${events.length} public ${
                    events.length === 1 ? 'event' : 'events'
                  }${latestEvent ? ` · Last event #${latestEvent.sequence}` : ''}`}
            </span>
          </div>
        </section>
      )}

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

      {!isRegistration && (
      <section className="gm-bulletin gm-bulletin-compact" id="market">
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
      )}

      {!isRegistration && (
        <section className="gm-battle-desk" aria-label="Live battle desk">
          <aside className="gm-desk-panel gm-desk-market">
            <div className="gm-desk-tabs" aria-label="Market desk views">
              <button
                type="button"
                aria-pressed={marketPanel === 'prices'}
                onClick={() => setMarketPanel('prices')}
              >
                Prices
              </button>
              <button
                type="button"
                aria-pressed={marketPanel === 'orders'}
                onClick={() => setMarketPanel('orders')}
              >
                Orders
              </button>
            </div>
            <div className="gm-desk-scroll">
              {marketPanel === 'prices' ? (
                <MarketIntelligence state={viewState} events={events} />
              ) : (
                <>
                  <MatchmakingPool state={viewState} events={events} />
                  <div className="gm-desk-pairings">
                    <div className="gm-panel-head">
                      <p className="label">Pairing rail</p>
                      <p>FCFS</p>
                    </div>
                    {pairs.length > 0 ? (
                      pairs.map((pair) => (
                        <article
                          className={`gm-pair-card ${pair.active ? 'is-live' : ''}`}
                          key={pair.id}
                        >
                          <div>
                            <span className="label">Buyer</span>
                            <strong>{pair.buyer}</strong>
                          </div>
                          <div
                            className="gm-pair-collision"
                            aria-label={`Trading ${pair.good}`}
                          >
                            <span />
                            <b>{pair.good}</b>
                            <span />
                          </div>
                          <div>
                            <span className="label">Seller</span>
                            <strong>{pair.seller}</strong>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="empty">No compatible orders have met yet.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>

          <main className="gm-desk-core">
            <div className="gm-desk-core-head">
              <div>
                <p className="label">Bargaining chamber · Live focus</p>
                <h2>
                  {currentPair
                    ? `${currentPair.buyer} × ${currentPair.seller}`
                    : 'Waiting for a pairing'}
                </h2>
              </div>
              <div className="gm-desk-core-meta">
                <span>{currentPair?.good || 'QUEUE OPEN'}</span>
                <b>{String(events.length).padStart(3, '0')} EVENTS</b>
              </div>
            </div>
            <div className="gm-desk-terminal">
              {currentPair ? (
                <NegotiationTerminal
                  events={events}
                  pairingId={currentPair.id}
                  pairingStatus={currentPair.status}
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
                  <span className="gm-waiting-mark" aria-hidden="true">II</span>
                  <p>The bargaining chamber is quiet.</p>
                  <span className="label">Waiting for a pairing</span>
                </div>
              )}
            </div>
            <SettlementRail events={events} pairing={currentPair?.id || pairs[0]?.id} />
          </main>

          <aside className="gm-desk-panel gm-desk-inspector">
            <div className="gm-desk-tabs" aria-label="Game inspector views">
              {(['agents', 'events', 'ledger'] as const).map((panel) => (
                <button
                  type="button"
                  aria-pressed={inspectorPanel === panel}
                  key={panel}
                  onClick={() => setInspectorPanel(panel)}
                >
                  {panel}
                  {panel === 'agents'
                    ? ` ${agents.length}`
                    : panel === 'events'
                      ? ` ${events.length}`
                      : ` ${trades.length}`}
                </button>
              ))}
            </div>
            <div className="gm-desk-scroll">
              {inspectorPanel === 'agents' && (
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
                          <span className="gm-agent-rank">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <strong>{agent.name}</strong>
                            <span>{agent.kind.toUpperCase()}</span>
                          </div>
                          <b>{agent.action}</b>
                        </div>
                      ))
                    ) : (
                      <p className="empty">Waiting for public participants</p>
                    )}
                  </div>
                </section>
              )}

              {inspectorPanel === 'events' && (
                <section className="gm-chronicle">
                  <div className="gm-panel-head">
                    <p className="label">Live chronicle</p>
                    <p>Public events only</p>
                  </div>
                  <div className="gm-chronicle-list" aria-live="polite">
                    {[...events]
                      .reverse()
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
                    {events.length === 0 && (
                      <p className="empty">Waiting for Arena events</p>
                    )}
                  </div>
                </section>
              )}

              {inspectorPanel === 'ledger' && (
                <section className="gm-desk-ledger" id="ledger">
                  <div className="gm-panel-head">
                    <p className="label">Committed ledger</p>
                    <p>Inventory authority</p>
                  </div>
                  <div className="gm-game-ledger-rows">
                    {trades.length > 0 ? (
                      trades.map((trade) => (
                        <article key={trade.pairingId}>
                          <span>R{String(trade.round || 0).padStart(2, '0')}</span>
                          <div>
                            <strong>{trade.buyer} → {trade.seller}</strong>
                            <small>
                              {trade.goodId.toUpperCase()} · QTY {trade.quantity}
                            </small>
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
                              ? 'COMMITTED'
                              : trade.status === 'confirmed'
                                ? 'CONFIRMED'
                                : trade.status === 'failed'
                                  ? 'NO DEAL'
                                  : 'SETTLING'}
                          </b>
                        </article>
                      ))
                    ) : (
                      <p className="empty">No settlement has reached the public ledger.</p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </section>
      )}

      {!isRegistration && (
        <MarketHistoryBoard state={viewState} events={events} />
      )}

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
