export const INITIAL_GOLD = 20;
export const INITIAL_GOLD_DECIMALS = 6;

export const INITIAL_GOODS = [
  { goodId: 'grain', name: 'Grain', mark: '粮', openingPrice: 2 },
  { goodId: 'iron', name: 'Iron', mark: '铁', openingPrice: 5 },
  { goodId: 'warhorse', name: 'Warhorse', mark: '马', openingPrice: 8 },
  { goodId: 'gems', name: 'Gems', mark: '宝', openingPrice: 3 },
] as const;

export type InitialGoodId = (typeof INITIAL_GOODS)[number]['goodId'];
export type InitialLoadout = Record<InitialGoodId, number>;

export interface InitialPortfolio {
  cashAtomic: string;
  holdings: InitialLoadout;
}

export interface InitialLoadoutResult {
  holdingsValue: number;
  cash: number;
  total: number;
  isValid: boolean;
  error: 'invalid_quantity' | 'over_budget' | null;
  portfolio: InitialPortfolio | null;
}

export const RECOMMENDED_LOADOUT: InitialLoadout = Object.freeze({
  grain: 2,
  iron: 1,
  warhorse: 0,
  gems: 3,
});

export function emptyInitialLoadout(): InitialLoadout {
  return { grain: 0, iron: 0, warhorse: 0, gems: 0 };
}

export function evaluateInitialLoadout(
  holdings: InitialLoadout,
): InitialLoadoutResult {
  const hasInvalidQuantity = INITIAL_GOODS.some(({ goodId }) => {
    const quantity = holdings[goodId];
    return !Number.isSafeInteger(quantity) || quantity < 0;
  });

  if (hasInvalidQuantity) {
    return {
      holdingsValue: 0,
      cash: INITIAL_GOLD,
      total: INITIAL_GOLD,
      isValid: false,
      error: 'invalid_quantity',
      portfolio: null,
    };
  }

  const holdingsValue = INITIAL_GOODS.reduce(
    (sum, { goodId, openingPrice }) =>
      sum + holdings[goodId] * openingPrice,
    0,
  );
  const cash = INITIAL_GOLD - holdingsValue;
  const isValid = cash >= 0;

  return {
    holdingsValue,
    cash,
    total: holdingsValue + cash,
    isValid,
    error: isValid ? null : 'over_budget',
    portfolio: isValid
      ? {
          cashAtomic: String(cash * 10 ** INITIAL_GOLD_DECIMALS),
          holdings: { ...holdings },
        }
      : null,
  };
}
