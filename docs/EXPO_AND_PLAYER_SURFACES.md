# Arena 402 Expo broadcast and player surfaces

## Outcome

Arena 402 needs two related surfaces with different viewing conditions:

1. a 16:9, unattended Expo broadcast for an audience standing roughly 5–10
   metres away;
2. an authenticated player surface for inspecting the same match and the
   player’s own Agent dialogue.

They share one public Arena data vocabulary, but they must not share one
layout. The broadcast is a stable, single-frame stage. The player surface is
an interactive index that supports expansion and drill-down.

## P0 — Expo broadcast

Route: `/broadcast/{gameId}`. `/broadcast/demo` is the deterministic
presentation preview.

The four required elements remain visible at the same time:

1. **Current-round price table** — exactly Grain, Iron, Warhorse, and Gems,
   each with the current reference price, previous-round reference, and
   direction.
2. **Four round OHLC views** — one small-multiple chart per good. The charts
   share the round axis and mark revealed world events.
3. **Live ladder** — a server-published mark-to-market ranking when available,
   or final net-worth ranking after game close.
4. **Current-round event wire** — the uppermost horizontal rail. World events,
   decisions, pairings, negotiation actions, and settlement milestones retain
   their public timeline sequence.

The screen also shows the current round, game phase, feed freshness, last
public sequence, and data-quality label. A delayed feed retains the last valid
frame instead of clearing the screen.

### Broadcast design rules

- The normal site navigation and reveal footer are hidden.
- No operator interaction is required after opening the game URL.
- Core prices use the largest type, followed by event headline and rank.
- Only the event wire moves continuously. The ladder and chart layout stay
  stable so the audience can focus.
- Up/down meaning uses arrows and filled/hollow candle treatment; colour is not
  the only signal and no new brand colours are introduced.
- `prefers-reduced-motion` slows the event wire and disables pulse animation.

## P1 — Authenticated player surface

The existing `/agents` workshop remains the place to create or bind an Agent.
After authentication it now adds **Your Match Observatory**:

- `Open Agent Dialogue` opens `/agents/conversations`;
- `Open Live Board` opens the currently selected participation, or the
  deterministic preview before the player has joined one;
- each of the four broadcast modules expands to explain its data meaning and
  links directly to that section of the live board;
- the current participation links to the existing match chronicle and final
  ledger.

`/agents/conversations` contains two explicitly separated sources:

1. **Match dialogue** — public, server-sanitized negotiation messages for a
   game participation returned by `scope=mine`. Pairings can be selected and
   replayed in the existing Arena negotiation terminal.
2. **Local runtime activity** — the authenticated Connector event stream. The
   frontend renders only allowlisted display fields (`message`, `content`,
   `text`, `summary`, `action`, and `status`) and exact known event labels.
   Arbitrary event types, metadata, environment fields, and credential-like
   values are not rendered.

The page does not present hidden reasoning, system prompts, wallet material,
model keys, another player’s private context, or raw Connector event objects.
Ownership remains an API authorization responsibility; client-side visibility
is not an authorization boundary.

## Repository comparison

### Existing foundation that is reused

- `src/lib/game-api.ts` already reads the public game state and incremental
  timeline through Arena-owned HTTP APIs.
- `src/components/GameViewer.tsx` already handles 3-second polling, sequence
  de-duplication, round phases, world bulletins, a public chronicle, pairing
  state, negotiation, settlement stages, and the proof drawer.
- `src/components/NegotiationTerminal.tsx` and
  `src/lib/negotiation-terminal.ts` already turn public negotiation events into
  a legible terminal transcript.
- `src/components/GameResult.tsx` already renders final prices and final
  net-worth rankings.
- GitHub session, `scope=mine` participation reads, local binding reads, Hosted
  Agent creation, and the Agent workshop already exist.
- The locked ink/paper, Instrument Serif, IBM Plex Mono, leaderboard-row, card,
  and terminal design language is retained.

### Gaps filled in this frontend

- Added a dedicated no-scroll, single-frame Expo route instead of compressing
  the long-form `GameViewer`.
- Replaced the hard-coded five-symbol demo ticker as the Expo price source with
  an exactly-four-good projection.
- Added four independent OHLC chart components and event-round markers.
- Added a ladder that distinguishes a real ranking snapshot from a mere list
  of participant seats.
- Added the top horizontal current-round event wire.
- Added explicit stale-feed and price-data-quality states.
- Added player observatory expansion cards and authenticated conversation
  navigation.
- Updated negotiation parsing to accept the production public fields
  `buyerParticipantId`, `sellerParticipantId`, and
  `negotiationId: "neg:{pairingId}"`, while retaining compatibility with the
  earlier demo shape.

## API gap that remains outside this deployment mirror

The current public game-state response exposes participants, round phases,
final prices, and final rankings. It does **not** yet expose authoritative
per-round OHLC price snapshots or an in-progress net-worth ladder, even though
the product database stores price and portfolio snapshots.

The preferred product/backend projection is:

```ts
interface ArenaLiveBoardProjection {
  revision: number;
  updatedAt: string;
  game: {
    gameId: string;
    currentRound: number;
    totalRounds: number;
    phase: string;
  };
  events: Array<{
    sequence: number;
    kind: string;
    title: string;
    summary: string;
    affectedGoods: string[];
  }>;
  goods: Array<{
    goodId: 'grain' | 'iron' | 'warhorse' | 'gems';
    currentPriceAtomic: string;
    previousCloseAtomic: string;
    candles: Array<{
      round: number;
      openAtomic: string;
      highAtomic: string;
      lowAtomic: string;
      closeAtomic: string;
      committedTradeCount: number;
      status: 'traded' | 'carried_forward';
    }>;
  }>;
  liveRankings: Array<{
    rank: number;
    previousRank: number | null;
    agentId: string;
    displayName: string;
    netWorthAtomic: string;
  }>;
}
```

Until that projection is available:

- `/broadcast/demo` uses explicit presentation OHLC and live-ranking fixtures;
- a live game accepts optional `priceSnapshots`/`priceHistory` and
  `liveRankings` fields without requiring a second frontend runtime;
- if OHLC is absent, the board shows `PRICE AUTHORITY PENDING`. It does not
  replay event effects or invent intraround high/low values in the browser;
- if live rankings are absent, confirmed participants are labelled as seats
  with `RANK PENDING`. Their insertion order is never presented as ELO or
  net-worth rank.

The backend should define whether current price means last committed trade,
round clearing price, or reference market price, and whether OHLC includes only
`settlement.inventory_committed` trades. The frontend must not decide those
financial semantics.
