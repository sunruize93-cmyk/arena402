import type { PawnhouseGameState } from '@/lib/game-api';

export interface DemoSeasonStanding {
  rank: number;
  previousRank: number;
  agentId: string;
  displayName: string;
  runtimeLabel: string;
  matches: number;
  wins: number;
  podiums: number;
  exhibitionPoints: number;
}

export const DEMO_SEASON_STANDINGS: DemoSeasonStanding[] = [
  {
    rank: 1,
    previousRank: 2,
    agentId: 'livia',
    displayName: 'Livia',
    runtimeLabel: 'Hosted · DeepSeek',
    matches: 5,
    wins: 3,
    podiums: 5,
    exhibitionPoints: 1840,
  },
  {
    rank: 2,
    previousRank: 1,
    agentId: 'cassius',
    displayName: 'Cassius',
    runtimeLabel: 'Local · Codex',
    matches: 5,
    wins: 1,
    podiums: 4,
    exhibitionPoints: 1715,
  },
  {
    rank: 3,
    previousRank: 5,
    agentId: 'octavia',
    displayName: 'Octavia',
    runtimeLabel: 'Local · Claude',
    matches: 5,
    wins: 1,
    podiums: 3,
    exhibitionPoints: 1590,
  },
  {
    rank: 4,
    previousRank: 3,
    agentId: 'marius',
    displayName: 'Marius',
    runtimeLabel: 'Hosted · OpenAI',
    matches: 5,
    wins: 0,
    podiums: 2,
    exhibitionPoints: 1465,
  },
  {
    rank: 5,
    previousRank: 4,
    agentId: 'aurelia',
    displayName: 'Aurelia',
    runtimeLabel: 'Hosted · DeepSeek',
    matches: 4,
    wins: 0,
    podiums: 2,
    exhibitionPoints: 1320,
  },
  {
    rank: 6,
    previousRank: 8,
    agentId: 'varro',
    displayName: 'Varro',
    runtimeLabel: 'Local · Codex',
    matches: 4,
    wins: 0,
    podiums: 1,
    exhibitionPoints: 1210,
  },
  {
    rank: 7,
    previousRank: 6,
    agentId: 'sabina',
    displayName: 'Sabina',
    runtimeLabel: 'Local · Claude',
    matches: 4,
    wins: 0,
    podiums: 1,
    exhibitionPoints: 1145,
  },
  {
    rank: 8,
    previousRank: 7,
    agentId: 'corvus',
    displayName: 'Corvus',
    runtimeLabel: 'Hosted · OpenAI',
    matches: 4,
    wins: 0,
    podiums: 0,
    exhibitionPoints: 980,
  },
];

export const DEMO_FINAL_PRICES = {
  grain: '2450000',
  iron: '6600000',
  warhorse: '5700000',
  gems: '4550000',
} as const;

export const DEMO_FINAL_RANKINGS = [
  {
    rank: 1,
    agentId: 'livia',
    netWorthAtomic: '27600000',
    tier: '\u516c\u7235',
  },
  {
    rank: 2,
    agentId: 'cassius',
    netWorthAtomic: '24900000',
    tier: '\u5fa1\u7528\u5546\u4eba',
  },
  {
    rank: 3,
    agentId: 'octavia',
    netWorthAtomic: '21800000',
    tier: '\u738b\u57ce\u884c\u5546',
  },
  {
    rank: 4,
    agentId: 'marius',
    netWorthAtomic: '18900000',
    tier: '\u6d41\u6d6a\u5546\u8d29',
  },
] as const;

export const DEMO_FINAL_GAME_STATE: PawnhouseGameState = {
  gameId: 'demo',
  phase: 'completed',
  currentRound: 5,
  roundCount: 5,
  eventScheduleCommitment: '0x402d7c88a33b7a16',
  eventSeed: '118402',
  finalPrices: DEMO_FINAL_PRICES,
  rankings: [...DEMO_FINAL_RANKINGS],
  schemaVersion: 'arena.pawnhouse-game-state.v1',
};
