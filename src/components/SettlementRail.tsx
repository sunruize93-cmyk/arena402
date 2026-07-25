import type { PawnhouseTimelineEvent } from '@/lib/game-api';

const STAGES = [
  {
    number: '01',
    label: 'Terms frozen',
    types: ['settlement.intent_frozen'],
  },
  {
    number: '02',
    label: 'Authorization',
    types: ['settlement.approved'],
  },
  {
    number: '03',
    label: 'Chain confirmed',
    types: ['settlement.chain_confirmed'],
  },
  {
    number: '04',
    label: 'Inventory committed',
    types: ['settlement.inventory_committed'],
  },
] as const;

const FAILURE_TYPES = new Set([
  'settlement.reverted',
  'settlement.confirmation_timeout',
  'settlement.failed',
]);

function pairingId(event: PawnhouseTimelineEvent): string {
  const value = event.data.pairingId ?? event.data.pairing_id;
  return typeof value === 'string' ? value : '';
}

export default function SettlementRail({
  events,
  pairing,
}: {
  events: PawnhouseTimelineEvent[];
  pairing?: string;
}) {
  const latestSettlement = [...events]
    .reverse()
    .find((event) => event.type.startsWith('settlement.'));
  const selectedPairing = pairing || (latestSettlement ? pairingId(latestSettlement) : '');
  const settlementEvents = events.filter(
    (event) =>
      event.type.startsWith('settlement.')
      && (!selectedPairing || pairingId(event) === selectedPairing),
  );
  const failed = settlementEvents.find((event) => FAILURE_TYPES.has(event.type));
  const reached = STAGES.map((stage) =>
    settlementEvents.some((event) => stage.types.includes(event.type as never)),
  );
  const firstPending = reached.findIndex((value) => !value);

  return (
    <section className="gm-settlement-chain" aria-labelledby="settlement-title">
      <div className="gm-panel-head">
        <p className="label" id="settlement-title">Settlement rail</p>
        <p>An accepted price is not a completed trade</p>
      </div>
      <div className="gm-seal-steps">
        {STAGES.map((stage, index) => (
          <div
            className={`gm-seal-step ${
              reached[index]
                ? 'is-complete'
                : !failed && index === firstPending
                  ? 'is-active'
                  : ''
            } ${failed && index === firstPending ? 'is-failed' : ''}`}
            key={stage.label}
          >
            <span>{stage.number}</span>
            <strong>{stage.label}</strong>
          </div>
        ))}
      </div>
      {failed && (
        <p className="gm-settlement-failure" role="status">
          Settlement closed as {failed.type.replace('settlement.', '').replaceAll('_', ' ')}.
          Inventory was not changed.
        </p>
      )}
      {settlementEvents.length === 0 && (
        <p className="gm-settlement-note">
          Awaiting accepted terms. Queue and negotiation activity do not change inventory.
        </p>
      )}
    </section>
  );
}
