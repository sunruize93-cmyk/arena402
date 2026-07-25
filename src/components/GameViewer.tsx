'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  getPawnhouseGame,
  getPawnhouseTimeline,
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';

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

const DEMO_STATE: PawnhouseGameState = {
  gameId: 'demo',
  phase: 'running',
  currentRound: 3,
  roundCount: 5,
  eventScheduleCommitment: '0x402d7c88a33b7a16',
  participants: [
    { agent_id: 'cassius', runtime_kind: 'hosted', status: 'active' },
    { agent_id: 'livia', runtime_kind: 'hosted', status: 'active' },
    { agent_id: 'marius', runtime_kind: 'remote', status: 'active' },
    { agent_id: 'octavia', runtime_kind: 'remote', status: 'active' },
  ],
  rounds: [
    { round_index: 1, phase: 'closed' },
    { round_index: 2, phase: 'closed' },
    { round_index: 3, phase: 'negotiating' },
  ],
  schemaVersion: 'arena.pawnhouse-game-state.v1',
};

const DEMO_EVENTS: PawnhouseTimelineEvent[] = [
  {
    sequence: 1,
    type: 'round.started',
    data: { roundIndex: 3 },
    occurredAt: '2026-07-25T04:32:10Z',
  },
  {
    sequence: 2,
    type: 'world.event_revealed',
    data: { eventId: 'granary-fire', round: 3 },
    occurredAt: '2026-07-25T04:32:11Z',
  },
  {
    sequence: 3,
    type: 'decision.applied',
    data: { agentId: 'cassius', action: 'buy', goodId: 'grain' },
    occurredAt: '2026-07-25T04:32:17Z',
  },
  {
    sequence: 4,
    type: 'decision.applied',
    data: { agentId: 'livia', action: 'sell', goodId: 'grain' },
    occurredAt: '2026-07-25T04:32:18Z',
  },
  {
    sequence: 5,
    type: 'decision.applied',
    data: { agentId: 'marius', action: 'pass' },
    occurredAt: '2026-07-25T04:32:20Z',
  },
  {
    sequence: 6,
    type: 'pairing.created',
    data: {
      pairingId: 'pair-03-a',
      buyerAgentId: 'cassius',
      sellerAgentId: 'livia',
      goodId: 'grain',
    },
    occurredAt: '2026-07-25T04:32:21Z',
  },
  {
    sequence: 7,
    type: 'negotiation.message',
    data: {
      pairingId: 'pair-03-a',
      actorAgentId: 'cassius',
      action: 'propose',
      priceAtomic: '2700000',
      quantity: 2,
      message: 'Two sacks before the northern gate closes.',
    },
    occurredAt: '2026-07-25T04:32:24Z',
  },
  {
    sequence: 8,
    type: 'negotiation.message',
    data: {
      pairingId: 'pair-03-a',
      actorAgentId: 'livia',
      action: 'propose',
      priceAtomic: '3100000',
      quantity: 2,
      message: 'Scarcity has its price. Three and one tenth.',
    },
    occurredAt: '2026-07-25T04:32:28Z',
  },
];

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
  const gold = Math.abs(numeric) >= 100_000 ? numeric / 1_000_000 : numeric;
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
  return events
    .filter((event) => event.type === 'pairing.created')
    .slice(-4)
    .reverse()
    .map((event, index) => {
      const data = event.data;
      return {
        id: publicText(
          pick(data, 'pairingId', 'pairing_id'),
          `pair-${event.sequence}`,
        ),
        buyer: shortAgent(pick(data, 'buyerAgentId', 'buyer_agent_id'), 'Buyer'),
        seller: shortAgent(pick(data, 'sellerAgentId', 'seller_agent_id'), 'Seller'),
        good: publicText(pick(data, 'goodId', 'good_id', 'good'), 'goods').toUpperCase(),
        active: index === 0,
      };
    });
}

function negotiationRows(events: PawnhouseTimelineEvent[], pairingId?: string) {
  return events
    .filter((event) => {
      if (event.type !== 'negotiation.message') return false;
      if (!pairingId) return true;
      return (
        publicText(pick(event.data, 'pairingId', 'pairing_id'), pairingId) === pairingId
      );
    })
    .slice(-3)
    .map((event) => ({
      sequence: event.sequence,
      agent: eventAgent(event.data),
      action: publicText(pick(event.data, 'action'), 'response').toUpperCase(),
      price: atomicGold(pick(event.data, 'priceAtomic', 'price_atomic', 'price')),
      quantity: Number(pick(event.data, 'quantity') || 1),
      message: publicText(
        pick(event.data, 'message', 'publicMessage', 'public_message'),
        'Terms submitted under the Arena negotiation contract.',
      ),
    }));
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
      name: shortAgent(id, `Agent ${String(index + 1).padStart(2, '0')}`),
      kind: publicText(pick(participant, 'runtimeKind', 'runtime_kind'), 'agent'),
      action: publicText(pick(lastDecision?.data, 'action'), 'waiting').toUpperCase(),
      active: Boolean(lastDecision),
    };
  });
}

export default function GameViewer({ gameId }: { gameId: string }) {
  const demo = gameId === 'demo';
  const [state, setState] = useState<PawnhouseGameState | null>(
    demo ? DEMO_STATE : null,
  );
  const [events, setEvents] = useState<PawnhouseTimelineEvent[]>(
    demo ? DEMO_EVENTS : [],
  );
  const [error, setError] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    if (demo) return;
    let after = 0;
    let stopped = false;

    async function refresh(signal?: AbortSignal) {
      try {
        const [nextState, timeline] = await Promise.all([
          getPawnhouseGame(gameId, signal),
          getPawnhouseTimeline(gameId, after, signal),
        ]);
        if (stopped) return;
        setState(nextState);
        if (timeline.events.length > 0) {
          after = timeline.nextAfter;
          setEvents((current) => {
            const merged = [...current, ...timeline.events];
            return merged
              .filter(
                (event, index, rows) =>
                  rows.findIndex((candidate) => candidate.sequence === event.sequence) ===
                  index,
              )
              .slice(-120);
          });
        }
        setError('');
      } catch (cause) {
        if (!stopped && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError('This table is not available from the public Arena API.');
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

  const phase = currentRoundPhase(state);
  const bulletin = useMemo(() => worldBulletin(events), [events]);
  const pairs = useMemo(() => pairingRows(events), [events]);
  const messages = useMemo(
    () => negotiationRows(events, pairs[0]?.id),
    [events, pairs],
  );
  const agents = useMemo(() => agentRows(state, events), [state, events]);
  const currentRound = Number(state?.currentRound || 0);
  const totalRounds = Number(state?.roundCount || state?.totalRounds || 0);
  const isComplete = String(state?.phase || '').toLowerCase() === 'completed';
  const latestEvent = events[events.length - 1];
  const settlementState = [...events]
    .reverse()
    .find((event) => event.type.startsWith('settlement.'));

  return (
    <section className="gm gm-live">
      <div className="gm-utility-row">
        <Link className="back-btn" href="/game">
          ← The Pawnhouse Gate
        </Link>
        <div className="gm-live-mark">
          <span className="gm-live-dot" aria-hidden="true" />
          {isComplete ? 'Ledger closed' : demo ? 'Scripted live demo' : 'Public live feed'}
        </div>
      </div>

      <header className="gm-live-head">
        <div>
          <p className="label">
            Game {publicText(gameId, 'Private table')} · King&apos;s Pawnhouse
          </p>
          <h1 className="display">
            Round {String(currentRound).padStart(2, '0')}
            <span> / {String(totalRounds).padStart(2, '0')}</span>
          </h1>
        </div>
        <div className="gm-head-status">
          <p className="label">Now in session</p>
          <p>{PHASES.find((item) => item.id === phase)?.label || 'Ledger closed'}</p>
        </div>
      </header>

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

      <section className="gm-bulletin">
        <div className="gm-bulletin-art" aria-hidden="true" />
        <div className="gm-bulletin-copy">
          <div className="gm-pin" aria-hidden="true" />
          <p className="label">Royal bulletin · Round {currentRound}</p>
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
              {String(latestEvent?.sequence || 0).padStart(3, '0')} events
            </span>
          </div>

          <section className="gm-queue" aria-labelledby="queue-title">
            <div className="gm-panel-head">
              <p className="label" id="queue-title">
                FCFS pairing rail
              </p>
              <p>Ordered by Arena receive time</p>
            </div>
            {pairs.length > 0 ? (
              <div className="gm-pair-list">
                {pairs.map((pair) => (
                  <article className={`gm-pair-card ${pair.active ? 'is-live' : ''}`} key={pair.id}>
                    <div>
                      <span className="label">Buyer</span>
                      <strong>{pair.buyer}</strong>
                    </div>
                    <div className="gm-pair-collision" aria-label={`Trading ${pair.good}`}>
                      <span />
                      <b>{pair.good}</b>
                      <span />
                    </div>
                    <div>
                      <span className="label">Seller</span>
                      <strong>{pair.seller}</strong>
                    </div>
                  </article>
                ))}
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
            {messages.length > 0 ? (
              <div className="gm-offer-list">
                {messages.map((message, index) => (
                  <article className="gm-offer" key={message.sequence}>
                    <div className="gm-offer-turn">
                      <span className="label">Seal {index + 1}</span>
                      <strong>{message.agent}</strong>
                    </div>
                    <div className="gm-offer-terms">
                      <span className="label">{message.action}</span>
                      <strong>
                        {message.price || '—'} <small>GOLD</small>
                      </strong>
                      <p>Quantity {message.quantity}</p>
                    </div>
                    <blockquote>“{message.message}”</blockquote>
                  </article>
                ))}
              </div>
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

          <section className="gm-settlement-chain" aria-labelledby="settlement-title">
            <div className="gm-panel-head">
              <p className="label" id="settlement-title">
                The seal
              </p>
              <p>An accepted price is not yet a completed trade</p>
            </div>
            <div className="gm-seal-steps">
              {[
                ['01', 'Terms frozen', 'settlement.intent_frozen'],
                ['02', 'Authorization', 'settlement.approved'],
                ['03', 'Chain confirmed', 'settlement.chain_confirmed'],
                ['04', 'Inventory committed', 'settlement.inventory_committed'],
              ].map(([number, label, type]) => {
                const typeIndex = events.findIndex((event) => event.type === type);
                const currentType = settlementState?.type;
                return (
                  <div
                    className={`gm-seal-step ${
                      typeIndex >= 0 ? 'is-complete' : currentType === type ? 'is-active' : ''
                    }`}
                    key={type}
                  >
                    <span>{number}</span>
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>
          </section>
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
                  <div className={`gm-agent-row ${agent.active ? 'is-active' : ''}`} key={`${agent.name}-${index}`}>
                    <span className="gm-agent-rank">{String(index + 1).padStart(2, '0')}</span>
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
