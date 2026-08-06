import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';
import {
  projectionValue as pick,
  publicAgentName,
} from '@/lib/public-projection';
import { projectCurrentRoundMarket } from '@/lib/market-projection';

const GOODS = ['grain', 'iron', 'warhorse', 'gems'] as const;

function displayName(value: unknown, fallback: string): string {
  return publicAgentName(value, fallback, 120);
}

function displayGold(value: number | null): string {
  if (value === null) return '';
  return `${(value / 1_000_000).toLocaleString('en-US', {
    maximumFractionDigits: 4,
  })} GOLD`;
}

export default function MatchmakingPool({
  state,
  events,
}: {
  state: PawnhouseGameState | null;
  events: PawnhouseTimelineEvent[];
}) {
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  const market = projectCurrentRoundMarket(state, events);
  const isA2A = market.protocol === 'agent_a2a.v1';
  const pairEvents = market.events.filter((event) =>
    ['pairing.created', 'market.engagement_created'].includes(event.type),
  );
  const orders = market.orders
    .filter(
      (order) =>
        ['buy', 'sell'].includes(order.side)
        && GOODS.includes(order.goodId as (typeof GOODS)[number]),
    );

  const latestDecision = new Map<string, PawnhouseTimelineEvent>();
  for (const event of market.events) {
    if (
      ![
        'decision.applied',
        'order.queued',
        'market.intent_published',
      ].includes(event.type)
    ) {
      continue;
    }
    const agentId = String(
      pick(
        event.data,
        'participantId',
        'participant_id',
        'agentId',
        'agent_id',
      ) || '',
    );
    if (agentId) latestDecision.set(agentId, event);
  }

  const matchedAgentIds = new Set(market.engagedParticipantIds);
  for (const event of pairEvents) {
    const buyer = String(
      pick(
        event.data,
        'buyerParticipantId',
        'buyer_participant_id',
        'buyerAgentId',
        'buyer_agent_id',
      ) || '',
    );
    const seller = String(
      pick(
        event.data,
        'sellerParticipantId',
        'seller_participant_id',
        'sellerAgentId',
        'seller_agent_id',
      ) || '',
    );
    if (buyer) matchedAgentIds.add(buyer);
    if (seller) matchedAgentIds.add(seller);
  }
  const participantNames = new Map<string, string>();
  participants.forEach((participant, index) => {
    const name = displayName(
      pick(
        participant,
        'displayName',
        'display_name',
        'agentId',
        'agent_id',
      ),
      `Agent ${index + 1}`,
    );
    for (const key of [
      pick(
        participant,
        'participantId',
        'participant_id',
        'gameParticipantId',
        'game_participant_id',
      ),
      pick(participant, 'agentId', 'agent_id'),
    ]) {
      if (key) participantNames.set(String(key), name);
    }
  });

  return (
    <section className="gm-matchmaking-pool" aria-labelledby="matchmaking-pool-title">
      <div className="gm-panel-head">
        <p className="label" id="matchmaking-pool-title">
          {isA2A ? 'A2A discovery market' : 'Matchmaking pool'}
        </p>
        <p>
          {isA2A
            ? 'Public intents become targeted RFQs and one-to-one engagements'
            : 'Agent orders are paired by Arena receive time'}
        </p>
      </div>
      <div
        className="gm-order-books"
        aria-label={
          isA2A ? 'A2A intent directory by good' : 'FCFS order queue by good'
        }
      >
        {GOODS.map((good) => (
          <article key={good}>
            <header>
              <span>{good.slice(0, 2).toUpperCase()}</span>
              <strong>{good}</strong>
            </header>
            {(['buy', 'sell'] as const).map((side) => {
              const queued = orders.filter(
                (order) => order.goodId === good && order.side === side,
              );
              return (
                <div key={side}>
                  <p className="label">
                    {isA2A ? `${side} intents` : `${side} queue · FCFS`}
                  </p>
                  {queued.length > 0 ? (
                    <ol>
                      {queued.map((order) => (
                        <li key={`${order.sequence}-${order.participantId}`}>
                          <span>#{String(order.sequence).padStart(3, '0')}</span>
                          <strong>
                            {participantNames.get(order.participantId)
                              || displayName(order.participantId, 'Agent')}
                          </strong>
                          <b>
                            QTY {order.quantity || '—'}
                            {isA2A && order.publicPriceAtomic !== null
                              ? ` · ${displayGold(order.publicPriceAtomic)}`
                              : ''}
                          </b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <em>No public {side} {isA2A ? 'intent' : 'order'}</em>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </div>
      {participants.length > 0 ? (
        <div className="gm-matchmaking-rows" aria-label="Agent decision status">
          {participants.map((participant, index) => {
            const agentId = String(pick(participant, 'agentId', 'agent_id') || '');
            const participantId = String(
              pick(
                participant,
                'participantId',
                'participant_id',
                'gameParticipantId',
                'game_participant_id',
              ) || '',
            );
            const decision =
              latestDecision.get(participantId)
              || latestDecision.get(agentId);
            const action = String(
              pick(decision?.data, 'side', 'action') || '',
            ).toUpperCase();
            const good = String(pick(decision?.data, 'goodId', 'good_id', 'good') || '').toUpperCase();
            const matched =
              matchedAgentIds.has(participantId)
              || matchedAgentIds.has(agentId);
            const stateLabel = matched
              ? isA2A ? 'ENGAGED' : 'MATCHED'
              : action === 'PASS'
                ? 'WATCHING'
                : action
                  ? `${action}${good ? ` · ${good}` : ''}`
                  : 'WAITING';
            return (
              <article className={`gm-matchmaking-row ${matched ? 'is-matched' : ''}`} key={`${agentId}-${index}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>
                    {displayName(
                      pick(participant, 'displayName', 'display_name', 'agentId', 'agent_id'),
                      `Agent ${index + 1}`,
                    )}
                  </strong>
                  <small>{String(pick(participant, 'runtimeKind', 'runtime_kind') || 'agent').toUpperCase()}</small>
                </div>
                <b>{stateLabel}</b>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="gm-waiting-board">
          <span className="gm-waiting-mark" aria-hidden="true">◇</span>
          <p>The matching pool is waiting for sealed seats.</p>
          <span className="label">No public participants yet</span>
        </div>
      )}
    </section>
  );
}
