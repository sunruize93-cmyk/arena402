# Arena 402 frontend agent guide

> AdventureX 2026 · Pawn Track · "Your Agent Is A Chess Piece"

## Repository role

This repository is the canonical Arena 402 product frontend and the Vercel
deployment source for [arena402.com](https://arena402.com).

The companion product/backend repository is
`E:\AI_Project\adx_agentic_payment`. It owns the Arena HTTP API, authentication,
game orchestration, Runtime control planes, PostgreSQL state, wallets, and
Injective testnet settlement. It no longer contains a `frontend/` directory.
Do not copy frontend files from the backend repository or create a second UI
runtime there.

Keep the repository boundary explicit:

| Concern | Authority |
| --- | --- |
| Pages, React components, browser API clients, i18n, and visual design | this repository |
| API schemas, authorization, game state, Runtime execution, settlement, and deployment | `E:\AI_Project\adx_agentic_payment` |
| Public game, price, ranking, reputation, wallet, and settlement truth | Arena-owned backend projections |
| Vercel production frontend | this repository's `main` branch |

Backend working-tree changes are not release evidence. In particular, migrations
or concurrency/service-split changes that exist only as uncommitted files in
`adx_agentic_payment` must be described as in progress until they are committed,
validated, and deployed.

## Product and claim boundaries

Arena 402 is a round-based AI trading game. Each Agent starts with an equal
20-gold portfolio, decides `buy | sell | pass`, publishes an Intent, sends or
reviews targeted RFQs, negotiates a selected Engagement with bounded
`propose | accept | reject` actions, and is ranked by final net worth. Current
Games use `agent_a2a.v1`; historical `fcfs.v1` games retain their frozen replay
semantics.

- The current website supports direct Arena accounts and optional GitHub OAuth.
- `/play` is the shortest guided path for a `READY` Hosted Agent.
- `/game` provides the full Agent -> 20-gold loadout -> PaymentMandate -> Join
  flow and the public Current Game.
- Hosted Agents may continue after the browser closes. Local Codex/Claude
  Runtimes depend on the outbound Connector remaining online.
- `accept` and `accepted_pending_settlement` are not completed trades. Only
  chain confirmation followed by Arena inventory commit supports
  `inventory_committed` or `settled`.
- The backend repository contains verified evidence for an eight-round
  production `agent_a2a.v1` Current Game with one real Codex Connector, nine
  Hosted Agents, and three self-hosted-Facilitator `arena402-g` settlements
  reaching inventory commit. Public third-party Facilitator compatibility,
  Claude A2A/payment-enabled production acceptance, and 100-Agent production
  capacity remain separate acceptance items.

Do not promote demo fixtures, seat order, pending settlement, configuration
capacity, or code presence into claims of official rankings, live prices,
completed payment, or production-scale acceptance.

## Architecture

The browser must not access Supabase, PostgreSQL, or another database directly.
All business state flows through Arena-owned HTTP APIs.

```text
Browser / Next.js
  -> Arena HTTP API
  -> Arena game and control-plane services
  -> PostgreSQL / Runtime workers / settlement workers
  -> Injective EVM testnet finality
```

For a Local Runtime, the website never calls the user's `localhost`:

```text
Arena API / Connector Gateway
  <- outbound HTTPS/WSS from adx-connector
  -> locally managed Codex or Claude process
```

The Connector acknowledgement is transport evidence, not a game-state
transition. Runtime results still pass through the backend Result Sink and
Consumer before Arena applies them.

### API routing

- Browser clients use the shared API helpers in `src/lib/`; components should
  not create an independent business API layer.
- Local development normally leaves `NEXT_PUBLIC_API_URL` blank. Browser calls
  stay same-origin under `/api/*`, and `next.config.js` rewrites them to
  `API_PROXY_TARGET`.
- `API_PROXY_TARGET` defaults to `https://api.arena402.com`. Set it to
  `http://127.0.0.1:8000` only for deliberate local-backend testing.
- Vercel production sets
  `NEXT_PUBLIC_API_URL=https://api.arena402.com`, so browser requests may be
  cross-origin. The API must allow the exact credentialed frontend origin.
- Never expose OAuth secrets, database credentials, wallet material, model API
  keys, SecretStore handles, or `service_role` keys through `NEXT_PUBLIC_*`.

The backend may split the stateless API and the single-worker Connector/WebSocket
ingress internally. That deployment topology must not create a second browser
contract: public frontend paths remain `/api/*`.

### Authentication and authorization

`/signin` supports direct Arena username/password accounts and optional GitHub
OAuth. Both resolve to the backend's immutable internal `user_id`, HttpOnly
session, CSRF validation, and server-side authorization.

Frontend visibility checks are presentation concerns only. Route hiding,
disabled buttons, or a successful session read never replace backend ownership
and admin checks.

### Game and player state

| Concern | Implementation |
| --- | --- |
| Guided journey | `src/components/PlayJourney.tsx` |
| Current Game entry | `src/components/GameLobby.tsx`, `GameEntryDesk.tsx`, `InitialLoadoutEditor.tsx` |
| Live/replay view | `src/components/GameViewer.tsx` |
| Result | `src/components/GameResult.tsx` |
| Public game API | `src/lib/game-api.ts` |
| Timeline projection | `src/lib/timeline-projection.ts` |
| Market interpretation | `src/lib/broadcast-model.ts`, `MarketIntelligence.tsx`, `MarketHistoryBoard.tsx` |
| Settlement display | `src/components/SettlementRail.tsx`, `src/lib/ledger-api.ts` |

The live game view prefers backend Server-Sent Events and falls back to
3-second polling. On every `gameId` change, clear the previous snapshot,
timeline, projection, and participant state before loading the next game.
Never let one game's state appear in another game.

The backend currently does not guarantee authoritative per-round OHLC,
in-progress net-worth rankings, or reputation snapshots in every public game
response. Render explicit pending/unknown states when those projections are
absent. Do not derive them from seats, event text, or frontend fixtures.

### Agent lifecycle

- Hosted Agent credentials use the dedicated write-only ingress.
- Reconfiguration uses owner-scoped
  `PATCH /api/hosted-agents/{agent_id}` and must not require resending a stored
  provider key.
- Active-game Runtime and configuration snapshots remain frozen when the base
  Agent is reconfigured.
- Do not physically delete historical Agent identity to solve a configuration
  problem. Deactivate, reconfigure safely, or create a new Agent according to
  the backend lifecycle.

### Admin surface

- Management APIs belong to the backend and use `/api/v1/admin/*`.
- Management pages belong here under `/admin/*`.
- Every admin mutation must reuse the existing session, CSRF, immutable
  subject/internal user identity, and audit mechanisms.
- Never render private keys, seed phrases, raw credential material, raw CSV
  rows, or copyable secret handles.

## Project structure

```text
arena402/
  src/
    app/                  # Next.js App Router routes and CSS systems
    components/           # Player, game, broadcast, wallet, and admin UI
    lib/                  # Typed Arena API clients and pure projections
  public/
    assets/               # Game and authentication artwork
    img/                  # Engraving artwork
  docs/                   # Player and maintainer documentation
  tests/                  # Node test suite
  next.config.js          # Same-origin /api rewrite for local development
  vercel.json             # Vercel framework and immutable artwork headers
  README.md
```

Read `README.md` first. Documentation purposes are indexed in
`docs/README.md`. `UPSTREAM_DESIGN.md` records the design-system and backend
integration boundary.

## Design constraints

The visual identity is locked. Do not arbitrarily change:

- color tokens: `--ink`, `--ink-deep`, `--paper`, and the existing grays;
- typography: Instrument Serif for display headings and IBM Plex Mono for
  body, controls, and labels;
- spacing: `--edge`, `--frame`, and the established section rhythm;
- patterns: tier badges, chips, cards, stat strips, battle rows, leaderboard
  rows, marquee dividers, terminal panels, and engraving treatment;
- dark-first canvas and the mix-blend navigation behavior.

Use existing CSS custom properties and established component patterns. Do not
introduce a second design system, another frontend runtime, or browser-side
business-state authority.

## Localization

English source copy plus `src/lib/i18n.ts` and
`src/lib/i18n-player-experience.ts` provide the player-facing zh-CN layer.
`LocaleProvider` covers DOM text and attributes, but native dialogs, dynamic
errors, statuses, and empty states require explicit handling and tests.

Translate player-facing prose completely. Preserve dynamic Agent/device names,
Game IDs, wallet addresses, commands, model names, API paths, and protocol
abbreviations exactly.

## Documentation rules

- Player guidance starts with the website path. Keep repository setup and
  deployment out of `docs/PLAYER_GUIDE.md`.
- `README.md` owns repository orientation and local development.
- `docs/FRONTEND_GAMEPLAY_GUIDE.md` owns the implemented frontend flow and
  backend contract boundary.
- `docs/EXPO_AND_PLAYER_SURFACES.md` owns broadcast, rankings-preview, and
  authenticated observatory behavior.
- Update active documents in place. Do not create a new document when an
  existing document already owns the topic.
- Use source and tests as implementation evidence. Use the backend's active
  README/game-design/roadmap for product and acceptance claims.

## Single-checkout discipline

For this Windows workspace:

1. Use only `E:\AI_Project\arena402` for frontend work.
2. Use only `https://github.com/sunruize93-cmyk/arena402.git` as this checkout's
   remote.
3. Use only port `4404` for the local frontend:

   ```powershell
   Set-Location E:\AI_Project\arena402
   npm run dev -- -p 4404
   ```

4. Before starting, inspect port `4404` and stop only a confirmed stale Arena
   Next.js process. Do not start a second clone or a second frontend server.
5. Use one browser tab at `http://localhost:4404`; disable cache while
   diagnosing stale assets.
6. `.env` and `.env.local` stay untracked. Only `.env.example` belongs in Git.

Do not use the obsolete `~/arena402`, `/Users/.../adx_agentic_payment/frontend`,
retired vanilla frontend, or `refactor/split-modules` instructions.

## Verification

Before committing documentation or frontend changes:

```powershell
npm test
npm run build
rg -n "service_role" src public
git diff --check
```

The secret scan should return no matches. Review `.env*` tracking without
printing values. For documentation changes, also verify every local Markdown
link and every documented route against `src/app`.
