'use client';

import {
  evaluateInitialLoadout,
  INITIAL_GOODS,
  InitialLoadout,
  RECOMMENDED_LOADOUT,
} from '@/lib/initial-loadout';

export default function InitialLoadoutEditor({
  value,
  onChange,
  locked = false,
}: {
  value: InitialLoadout;
  onChange: (next: InitialLoadout) => void;
  locked?: boolean;
}) {
  const result = evaluateInitialLoadout(value);

  function adjust(goodId: keyof InitialLoadout, delta: number) {
    if (locked) return;
    onChange({
      ...value,
      [goodId]: Math.max(0, value[goodId] + delta),
    });
  }

  return (
    <div className={`gm-loadout ${locked ? 'is-locked' : ''}`}>
      <div className={`gm-loadout-total ${result.isValid ? '' : 'is-error'}`}>
        <div>
          <p className="label">Opening allocation</p>
          <strong>TOTAL 20.00 / 20.00 GOLD</strong>
        </div>
        <span>
          {result.isValid
            ? `${result.cash}.00 GOLD LIQUID`
            : `${Math.abs(result.cash)}.00 GOLD OVER`}
        </span>
      </div>

      <div className="gm-loadout-rows">
        {INITIAL_GOODS.map((good, index) => {
          const quantity = value[good.goodId];
          const occupied = quantity * good.openingPrice;
          return (
            <article key={good.goodId}>
              <span className="gm-loadout-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="gm-loadout-mark" aria-hidden="true">
                {good.mark}
              </span>
              <div>
                <strong>{good.name}</strong>
                <small>Opening price · {good.openingPrice}.00 gold</small>
              </div>
              <span className="gm-loadout-value">{occupied}.00</span>
              <div className="gm-stepper" aria-label={`${good.name} quantity`}>
                <button
                  type="button"
                  onClick={() => adjust(good.goodId, -1)}
                  disabled={locked || quantity === 0}
                  aria-label={`Remove one ${good.name}`}
                >
                  −
                </button>
                <output aria-live="polite">{quantity}</output>
                <button
                  type="button"
                  onClick={() => adjust(good.goodId, 1)}
                  disabled={locked}
                  aria-label={`Add one ${good.name}`}
                >
                  +
                </button>
              </div>
            </article>
          );
        })}

        <article className="gm-loadout-cash">
          <span className="gm-loadout-index">05</span>
          <span className="gm-loadout-mark" aria-hidden="true">金</span>
          <div>
            <strong>Cash</strong>
            <small>Remainder · read only</small>
          </div>
          <span className="gm-loadout-value">{result.cash}.00</span>
          <span className="gm-loadout-readonly">LIQUID</span>
        </article>
      </div>

      {!locked && (
        <button
          type="button"
          className="gm-text-link gm-loadout-reset"
          onClick={() => onChange({ ...RECOMMENDED_LOADOUT })}
        >
          Reset loadout · Recommended balanced
        </button>
      )}

      {!result.isValid && (
        <p className="data-state error" role="alert">
          Reduce goods until the opening portfolio is no more than 20 gold.
        </p>
      )}
    </div>
  );
}
