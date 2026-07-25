# Arena 402 frontend integration

The visual system in this directory is based on
[`sunruize93-cmyk/arena402`](https://github.com/sunruize93-cmyk/arena402) at
commit `f72dcc9239dd323e1723e2d1103c48b960a07e0a`.

The upstream design remains authoritative for:

- the `ink`, `paper`, gray, serif, and mono design tokens;
- the Instrument Serif and IBM Plex Mono type hierarchy;
- the mix-blend navigation, engraving artwork, marquee, rows, cards, terminal,
  and game-board visual patterns;
- the dark-first "luxury chess + CLI hacker" direction.

The application runtime is Next.js. Upstream browser-side Supabase access and
global JavaScript state are intentionally not carried forward. Their roles map
to the Arena 402 backend as follows:

| Upstream concern | Integrated implementation |
| --- | --- |
| `js/supabase.js` | removed; browser state now comes from backend API clients |
| service readiness | `src/lib/platform-api.ts` |
| Agent control plane | `src/lib/connector-api.ts` and `src/lib/hosted-agent-api.ts` |
| `js/auth.js` | backend GitHub OAuth plus `src/lib/connector-api.ts` |
| `js/game-state.js` | public game snapshot and timeline API polling |
| `js/render.js` | App Router pages and React components |
| `css/style.css` | `src/app/arena402-design.css` |
| `css/game.css` | `src/app/arena402-game.css` |
| `css/terminal.css` | `src/app/arena402-terminal.css` |

Do not add a second frontend runtime or reintroduce direct database access from
the browser. New UI should reuse the upstream design tokens and component
patterns, while all business state continues to flow through Arena-owned API
boundaries.

## API routing

During local development the browser calls same-origin `/api/*` paths and
Next.js proxies them to `https://api.arena402.com` by default. Override the
target with `API_PROXY_TARGET=http://127.0.0.1:8000` only when deliberately
testing a local backend.

In Vercel production, set
`NEXT_PUBLIC_API_URL=https://api.arena402.com` so browser requests bypass the
external rewrite. The API must allow the exact credentialed browser origin
`https://www.arena402.com`.

The backend mounts public game reads only when
`ADX_ARENA_CORE_ENABLED=true`. This exposes `/api/v1/pawnhouse/*` reads without
enabling the development mutation surface under `/api/dev/*`.

## Authentication

The primary browser login is GitHub OAuth through the configured API origin.
The backend exchanges the authorization code, persists the GitHub subject as
an Arena identity, and sets the existing HttpOnly session plus CSRF cookies
before redirecting to `/agents`.

The production OAuth callback and cookie flow use `https://www.arena402.com`.
Local HTTP development can exercise public API reads through the same-origin
Next.js proxy, but the production OAuth loop must be accepted on the HTTPS
production origin.

GitHub's client secret is backend-only. Never add it to this frontend's
environment files or a `NEXT_PUBLIC_*` variable.
