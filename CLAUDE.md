# Arena 402 deployment frontend

> AdventureX 2026 · Pawn Track · "Your Agent Is A Chess Piece"

## Repository role

This repository is the Vercel deployment mirror for the Arena 402 frontend.
The product repository is `/Users/sunruize/adx_agentic_payment`, and the
canonical integrated frontend lives in its `frontend/` directory.
The production frontend is served at `https://arena402.com`.

The frontend in this repository is intentionally placed at the repository
root because the existing Vercel project is connected to this repository.
When synchronizing product changes, copy from
`/Users/sunruize/adx_agentic_payment/frontend/` into this root, review the
result, and verify a production build before committing.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, React 18, TypeScript |
| Backend | Arena 402 API from `adx_agentic_payment` |
| Hosting | Vercel |
| Fonts | Instrument Serif and IBM Plex Mono |

The browser must not access Supabase or another database directly. All
business state flows through Arena-owned HTTP APIs.

### API routing

Browser requests use same-origin `/api/*` URLs. `next.config.js` proxies them
to `API_PROXY_TARGET`.

- Local default backend: `http://127.0.0.1:8000`
- Production default backend: `https://api.arena402.com`
- Keep `NEXT_PUBLIC_API_URL` blank for the normal same-origin deployment.

This same-origin boundary is important for Auth, CSRF, and Connector cookies.
Do not expose a backend secret, wallet credential, `service_role` key, or
model API key through a `NEXT_PUBLIC_*` variable.

The public Pawnhouse game read API additionally requires the backend setting:

```text
ADX_ARENA_CORE_ENABLED=true
```

## Project structure

```text
arena402/
  src/
    app/                  # App Router pages and the Arena 402 CSS system
    components/           # Shared React UI
    lib/                  # Arena, game, Connector, and Hosted Agent API clients
  public/
    assets/               # Game artwork
    img/                  # Engraving artwork
  next.config.js          # Same-origin API proxy
  vercel.json             # Vercel framework and cache headers
  package.json
```

See `UPSTREAM_DESIGN.md` for the visual migration and API mapping.

## Local development

The single local frontend remains `~/arena402` on port `4404`:

```bash
cd ~/arena402
npm ci
npm run dev -- -p 4404
```

Use `http://localhost:4404`. Do not start a second clone or a second frontend
server. The backend runs separately from `adx_agentic_payment`, normally on
`http://127.0.0.1:8000`.

For an explicit local proxy override, create an untracked `.env.local`:

```text
NEXT_PUBLIC_API_URL=
API_PROXY_TARGET=http://127.0.0.1:8000
```

## Design constraints

The visual identity is locked:

- Use the established `--ink`, `--ink-deep`, `--paper`, and gray tokens.
- Use Instrument Serif for display headings and IBM Plex Mono for body/labels.
- Reuse `--edge`, `--frame`, established rows, cards, chips, and stat strips.
- Keep the dark-first “luxury chess + CLI hacker” direction.
- Preserve the mix-blend navigation behavior.
- Match the grayscale engraving treatment for new imagery.

Do not introduce another frontend runtime, a second design system, or direct
database access. Extend the App Router pages, React components, and API clients
already present here.

## Verification

Before committing:

```bash
npm run build
grep -RIn "service_role" src public \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html'
```

Review `.env*` carefully. Only `.env.example` belongs in Git.
