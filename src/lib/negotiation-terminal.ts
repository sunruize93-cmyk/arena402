import type { PawnhouseTimelineEvent } from '@/lib/game-api';
import {
  projectionValue as pick,
  publicAgentName,
  publicProjectionText,
} from '@/lib/public-projection';

export type NegotiationTerminalLineKind =
  | 'sys'
  | 'buyer'
  | 'seller'
  | 'ok'
  | 'bad';

export interface NegotiationTerminalLine {
  key: string;
  kind: NegotiationTerminalLineKind;
  text: string;
  quote?: boolean;
  highlight?: boolean;
}

function cleanText(value: unknown, fallback: string): string {
  return publicProjectionText(value, fallback);
}

function agentName(value: unknown, fallback: string): string {
  return publicAgentName(value, fallback, 120);
}

export function eventPairingId(event: PawnhouseTimelineEvent): string {
  const pairingId = cleanText(
    pick(event.data, 'pairingId', 'pairing_id'),
    '',
  );
  if (pairingId) return pairingId;
  const engagementId = cleanText(
    pick(event.data, 'engagementId', 'engagement_id'),
    '',
  );
  if (engagementId) {
    return engagementId.startsWith('pairing:')
      ? engagementId
      : `pairing:${engagementId}`;
  }
  const negotiationId = cleanText(
    pick(event.data, 'negotiationId', 'negotiation_id'),
    '',
  );
  if (negotiationId.startsWith('neg:')) {
    return negotiationId.slice('neg:'.length);
  }
  if (negotiationId.startsWith('negotiation:')) {
    return `pairing:engagement:${negotiationId.slice('negotiation:'.length)}`;
  }
  if (negotiationId) return negotiationId;
  const settlementIntentId = cleanText(
    pick(event.data, 'settlementIntentId', 'settlement_intent_id'),
    '',
  );
  if (settlementIntentId.startsWith('settlement:negotiation:')) {
    return `pairing:engagement:${settlementIntentId.slice(
      'settlement:negotiation:'.length,
    )}`;
  }
  const requestId = cleanText(
    pick(event.data, 'requestId', 'request_id'),
    '',
  );
  return requestId ? `pairing:engagement:${requestId}` : '';
}

function terminalTime(event: PawnhouseTimelineEvent): string {
  if (!event.occurredAt) return `#${String(event.sequence).padStart(3, '0')}`;
  const date = new Date(event.occurredAt);
  if (Number.isNaN(date.getTime())) {
    return `#${String(event.sequence).padStart(3, '0')}`;
  }
  return date.toISOString().slice(11, 19);
}

function terminalPrice(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const gold = Math.abs(numeric) >= 100_000 ? numeric / 1_000_000 : numeric;
  return gold.toLocaleString('en-US', {
    minimumFractionDigits: gold % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export function buildNegotiationTerminalLines(
  events: PawnhouseTimelineEvent[],
  pairingId: string,
): NegotiationTerminalLine[] {
  const pairing = events.find(
    (event) =>
      ['pairing.created', 'market.engagement_created'].includes(event.type)
      && eventPairingId(event) === pairingId,
  );
  if (!pairing) return [];

  const buyerId = cleanText(
    pick(
      pairing.data,
      'buyerAgentId',
      'buyer_agent_id',
      'buyerParticipantId',
      'buyer_participant_id',
      'buyer',
    ),
    'buyer',
  );
  const sellerId = cleanText(
    pick(
      pairing.data,
      'sellerAgentId',
      'seller_agent_id',
      'sellerParticipantId',
      'seller_participant_id',
      'seller',
    ),
    'seller',
  );
  const buyer = agentName(buyerId, 'Buyer');
  const seller = agentName(sellerId, 'Seller');
  const good = cleanText(
    pick(pairing.data, 'goodId', 'good_id', 'good'),
    'goods',
  ).toUpperCase();
  const openedAt = terminalTime(pairing);
  const lines: NegotiationTerminalLine[] = [
    {
      key: `${pairingId}:buyer-connected`,
      kind: 'sys',
      text: `[${openedAt}] BUYER connected — ${buyer}`,
    },
    {
      key: `${pairingId}:seller-connected`,
      kind: 'sys',
      text: `[${openedAt}] SELLER connected — ${seller}`,
    },
    {
      key: `${pairingId}:channel`,
      kind: 'sys',
      text: `CHANNEL: ${good} ──────────────────`,
    },
  ];

  const relevant = events.filter(
    (event) =>
      eventPairingId(event) === pairingId &&
      (event.type === 'negotiation.message' || event.type.startsWith('settlement.')),
  );
  let lastPrice: string | null = null;
  let turn = 0;

  for (const event of relevant) {
    if (event.type === 'negotiation.message') {
      const action = cleanText(pick(event.data, 'action', 'type'), 'response').toUpperCase();
      const actorId = cleanText(
        pick(event.data, 'actorAgentId', 'actor_agent_id', 'agentId', 'agent_id'),
        buyerId,
      );
      const reportedRole = cleanText(pick(event.data, 'role', 'actorRole'), '');
      const role =
        reportedRole.toLowerCase() === 'seller' || actorId === sellerId
          ? 'SELLER'
          : 'BUYER';
      const kind = role === 'SELLER' ? 'seller' : 'buyer';
      const price = terminalPrice(
        pick(event.data, 'priceAtomic', 'price_atomic', 'price'),
      );
      if (price) lastPrice = price;
      const quantity = Number(pick(event.data, 'quantity') || 1);
      const message = cleanText(
        pick(event.data, 'message', 'publicMessage', 'public_message'),
        '',
      );
      const sequenceKey = `${pairingId}:event-${event.sequence}`;

      if (action === 'ACCEPT') {
        lines.push({
          key: sequenceKey,
          kind: 'ok',
          text: `$ ${role} > ACCEPT${price || lastPrice ? ` ${price || lastPrice} GOLD` : ''}  ✓`,
        });
        lines.push({
          key: `${sequenceKey}:confirmed`,
          kind: 'ok',
          text: '═══ TRADE CONFIRMED ═══',
          highlight: true,
        });
      } else if (action === 'REJECT') {
        lines.push({
          key: sequenceKey,
          kind: 'bad',
          text: `$ ${role} > REJECT  ✗`,
        });
        lines.push({
          key: `${sequenceKey}:closed`,
          kind: 'bad',
          text: '═══ CHANNEL CLOSED — NO DEAL ═══',
          highlight: true,
        });
      } else {
        turn += role === 'BUYER' ? 1 : 0;
        lines.push({
          key: sequenceKey,
          kind,
          text: `$ ${role} > ${action}${price ? ` ${price} GOLD` : ''} · QTY ${quantity}   [TURN ${Math.max(turn, 1)}/3]`,
        });
        if (message) {
          lines.push({
            key: `${sequenceKey}:message`,
            kind,
            text: `│ “${message}”`,
            quote: true,
          });
        }
      }
      continue;
    }

    const sequenceKey = `${pairingId}:event-${event.sequence}`;
    const tx = cleanText(
      pick(event.data, 'txHash', 'tx_hash', 'transactionHash', 'transaction_hash'),
      '',
    );
    if (event.type === 'settlement.intent_frozen') {
      lines.push({
        key: sequenceKey,
        kind: 'sys',
        text: '$ ARENA > TERMS FROZEN · awaiting authorization',
      });
    } else if (event.type === 'settlement.approved') {
      lines.push({
        key: sequenceKey,
        kind: 'sys',
        text: '$ WALLET > PAYMENT AUTHORIZED',
      });
    } else if (event.type === 'settlement.submitted') {
      lines.push({
        key: sequenceKey,
        kind: 'sys',
        text: `$ X402 > SUBMITTED${tx ? ` · ${tx}` : ''}`,
      });
    } else if (event.type === 'settlement.chain_confirmed') {
      lines.push({
        key: sequenceKey,
        kind: 'ok',
        text: `TX: ${tx || 'CONFIRMED'}  ✓  x402 · CHAIN CONFIRMED`,
      });
    } else if (event.type === 'settlement.inventory_committed') {
      lines.push({
        key: sequenceKey,
        kind: 'ok',
        text: 'LEDGER: INVENTORY COMMITTED  ✓',
      });
      lines.push({
        key: `${sequenceKey}:closed`,
        kind: 'sys',
        text: 'SESSION CLOSED',
      });
    } else if (
      event.type === 'settlement.reverted' ||
      event.type === 'settlement.confirmation_timeout'
    ) {
      lines.push({
        key: sequenceKey,
        kind: 'bad',
        text: `$ X402 > ${event.type.endsWith('timeout') ? 'CONFIRMATION TIMEOUT' : 'SETTLEMENT REVERTED'}  ✗`,
        highlight: true,
      });
    }
  }

  return lines;
}
