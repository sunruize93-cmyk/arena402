import { memo } from 'react';

const INSTRUMENTS = [
  {
    symbol: 'GRAIN',
    price: '2.03',
    delta: '+1.50%',
    direction: 'up',
    spark: '2,12 6,10 10,11 14,7 18,8 22,4 26,6 30,2',
  },
  {
    symbol: 'IRON',
    price: '5.47',
    delta: '-0.55%',
    direction: 'down',
    spark: '2,3 6,5 10,4 14,8 18,7 22,11 26,9 30,13',
  },
  {
    symbol: 'WARHORSE',
    price: '8.08',
    delta: '+1.00%',
    direction: 'up',
    spark: '2,11 6,12 10,8 14,9 18,5 22,7 26,3 30,2',
  },
  {
    symbol: 'GEMS',
    price: '4.16',
    delta: '-0.95%',
    direction: 'down',
    spark: '2,4 6,3 10,7 14,5 18,10 22,8 26,12 30,13',
  },
  {
    symbol: 'GOLD',
    price: '1.00',
    delta: '+0.08%',
    direction: 'up',
    spark: '2,9 6,8 10,9 14,7 18,7 22,5 26,6 30,4',
  },
] as const;

function TickerSet({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <span className="gm-price-ticker-set" aria-hidden={duplicate || undefined}>
      {INSTRUMENTS.map((instrument) => (
        <span className="gm-price-ticker-item" key={instrument.symbol}>
          <span className="gm-price-symbol">{instrument.symbol}</span>
          <span className="gm-price-value">{instrument.price}</span>
          <span className={`gm-price-delta ${instrument.direction}`}>
            {instrument.delta}
          </span>
          <svg
            className={`gm-price-spark ${instrument.direction}`}
            viewBox="0 0 32 16"
            aria-hidden="true"
          >
            <polyline points={instrument.spark} />
          </svg>
        </span>
      ))}
    </span>
  );
}

function MarketPriceTicker() {
  return (
    <div
      className="gm-price-ticker"
      data-price-ticker="persistent"
      data-price-source="demo-fixture"
      aria-label="Illustrative demo market prices: Grain 2.03 up 1.50 percent; Iron 5.47 down 0.55 percent; Warhorse 8.08 up 1 percent; Gems 4.16 down 0.95 percent; Gold 1.00 up 0.08 percent."
    >
      <div className="gm-price-ticker-track">
        <TickerSet />
        <TickerSet duplicate />
      </div>
    </div>
  );
}

export default memo(MarketPriceTicker);
