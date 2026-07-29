import type {
  PawnhouseGameState,
  PawnhouseTimelineEvent,
} from '@/lib/game-api';
import {
  projectionValue as pick,
  publicAgentName,
} from '@/lib/public-projection';
import type { ProjectionRecord as RecordValue } from '@/lib/public-projection';

const GOODS = ['grain', 'iron', 'warhorse', 'gems'] as const;

function displayName(value: unknown, fallback: string): string {
  return publicAgentName(value, fallback, 120);
}

export default function MatchmakingPool({
  state,
  events,
}: {
  state: PawnhouseGameState | null;
  events: PawnhouseTimelineEvent[];
}) {
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  const currentRound = Number(state?.currentRound || 0);
  const currentRoundStart = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'round.started' &&
        Number(pick(event.data, 'round', 'roundIndex', 'round_index')) ===
          currentRound,
    )?.sequence;
  const roundEvents = currentRoundStart === undefined
    ? events.filter(
        (event) =>
          Number(pick(event.data, 'round', 'roundIndex', 'round_index')) ===
            currentRound,
      )
    : events.filter((event) => event.sequence >= currentRoundStart);
  const pairEvents = roundEvents.filter((event) => event.type === 'pairing.created');
  const orders = roundEvents
    .filter((event) => ['order.queued', 'decision.applied'].includes(event.type))
    .map((event) => ({
      sequence: event.sequence,
      agentId: String(
        pick(event.data, 'agentId', 'agent_id', 'participantId', 'participant_id') || '',
      ),
      side: String(pick(event.data, 'side', 'action', 'intent') || '').toLowerCase(),
      goodId: String(pick(event.data, 'goodId', 'good_id', 'good') || '').toLowerCase(),
      quantity: Number(pick(event.data, 'quantity', 'qty') || 0),
    }))
    .filter(
      (order) =>
        ['buy', 'sell'].includes(order.side)
        && GOODS.includes(order.goodId as (typeof GOODS)[number]),
    );

  const latestDecision = new Map<string, PawnhouseTimelineEvent>();
  for (const event of roundEvents) {
    if (!['decision.applied', 'order.queued'].includes(event.type)) continue;
    const agentId = String(pick(event.data, 'agentId', 'agent_id') || '');
    if (agentId) latestDecision.set(agentId, event);
  }

  const matchedAgentIds = new Set<string>();
  for (const event of pairEvents) {
    const buyer = String(pick(event.data, 'buyerAgentId', 'buyer_agent_id') || '');
    const seller = String(pick(event.data, 'sellerAgentId', 'seller_agent_id') || '');
    if (buyer) matchedAgentIds.add(buyer);
    if (seller) matchedAgentIds.add(seller);
  }

  return (
    <section className="gm-matchmaking-pool" aria-labelledby="matchmaking-pool-title">
      <div className="gm-panel-head">
        <p className="label" id="matchmaking-pool-title">Matchmaking pool</p>
        <p>Agent orders are paired by Arena receive time</p>
      </div>
      <div className="gm-order-books" aria-label="FCFS order queue by good">
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
                  <p className="label">{side} queue · FCFS</p>
                  {queued.length > 0 ? (
                    <ol>
                      {queued.map((order) => (
                        <li key={`${order.sequence}-${order.agentId}`}>
                          <span>#{String(order.sequence).padStart(3, '0')}</span>
                          <strong>{displayName(order.agentId, 'Agent')}</strong>
                          <b>QTY {order.quantity || '—'}</b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <em>No public {side} order</em>
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
            const decision = latestDecision.get(agentId);
            const action = String(pick(decision?.data, 'action') || '').toUpperCase();
            const good = String(pick(decision?.data, 'goodId', 'good_id', 'good') || '').toUpperCase();
            const matched = matchedAgentIds.has(agentId);
            const stateLabel = matched
              ? 'MATCHED'
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
