# Arena 402 design system and backend integration

This repository is now the authoritative Arena 402 frontend. The companion
`adx_agentic_payment` repository owns backend product behavior and contains no
second frontend tree.

The visual system originated from the earlier Arena 402 design baseline at
commit `f72dcc9239dd323e1723e2d1103c48b960a07e0a`. That commit is historical
provenance, not a source to copy over the current React implementation.

## Visual authority

Current visual authority lives in:

- `src/app/arena402-design.css` for global ink/paper, typography, navigation,
  cards, rows, and section patterns;
- `src/app/arena402-game.css` for the Current Game and result experience;
- `src/app/arena402-terminal.css` for negotiation and CLI surfaces;
- `src/app/arena402-broadcast.css` for the Expo board;
- `src/app/arena402-player.css` for the guided player journey;
- the React components that already use those systems.

Preserve:

- the `--ink`, `--ink-deep`, `--paper`, and existing gray tokens;
- Instrument Serif display headings and IBM Plex Mono body/labels;
- mix-blend navigation, grayscale engraving artwork, marquee dividers, stat
  strips, cards, tiers, leaderboard rows, and terminal panels;
- the dark-first "luxury chess + CLI hacker" direction.

Do not re-import the retired vanilla JavaScript runtime, global browser game
state, or browser-side database access.

## Runtime mapping

| Historical concern | Current implementation |
| --- | --- |
| browser-side Supabase | removed; all business state comes from Arena HTTP APIs |
| authentication | direct Arena accounts or GitHub OAuth through `src/lib/connector-api.ts` |
| Local Agent pairing | `src/components/ConnectorConsole.tsx` and `src/lib/connector-api.ts` |
| Hosted Agent lifecycle | `src/components/HostedAgentCreator.tsx` and `src/lib/hosted-agent-api.ts` |
| guided entry | `src/components/PlayJourney.tsx` |
| formal Current Game entry | `GameEntryDesk.tsx`, `InitialLoadoutEditor.tsx`, `src/lib/game-api.ts` |
| live game state | public snapshot + SSE timeline with polling fallback |
| market projection | `src/lib/broadcast-model.ts`, `MarketIntelligence.tsx`, `MarketHistoryBoard.tsx` |
| final result | `src/components/GameResult.tsx` |
| public settlement ledger | `src/lib/ledger-api.ts`, `ImperialLedger.tsx` |
| localization | `LocaleProvider`, `src/lib/i18n.ts`, `src/lib/i18n-player-experience.ts` |

## API boundary

Local development uses same-origin `/api/*` calls. `next.config.js` rewrites
them to `API_PROXY_TARGET`, which defaults to
`https://api.arena402.com`. Override it with
`http://127.0.0.1:8000` only for intentional local-backend testing.

Vercel production sets:

```text
NEXT_PUBLIC_API_URL=https://api.arena402.com
```

The backend must allow the exact credentialed frontend origin. Sessions are
HttpOnly, mutations require CSRF validation, and ownership/administration is
authorized on the server.

The backend may split its API, Connector/WebSocket ingress, Workers, and
settlement services. That topology remains opaque to the browser: frontend
clients continue to use the stable Arena `/api/*` contract.

## Data interpretation

- Seats are not rankings.
- Public events are not a price authority.
- Demo fixtures are not live game evidence.
- `accept` is not payment.
- `confirmed` is not necessarily inventory commit.
- Only backend-published rankings and committed settlement/inventory state can
  be rendered as final results.

When authoritative OHLC, live rankings, or reputation snapshots are absent,
show an explicit pending/unknown state. Do not calculate a competing financial
or reputation history in the browser.

## Authentication and secrets

Direct accounts and GitHub OAuth both resolve to the Arena backend's internal
user identity and session. GitHub is optional and never grants payment
authority or repository access.

Hosted model credentials use a dedicated write-only ingress. Local Runtime
credentials remain local. Never add OAuth client secrets, model keys, wallet
private keys, seed phrases, database credentials, or SecretStore handles to
frontend environment files, rendered UI, logs, fixtures, or `NEXT_PUBLIC_*`.
