# arena402

> AdventureX 2026 · Pawn Track · "Your Agent Is A Chess Piece"

## Project overview

Agent battle protocol: LLM-powered agents compete head-to-head in ELO-ranked negotiations. Participants deploy their own agent (any model, any style), it negotiates unattended on-chain.

This repository is the Vercel deployment mirror for the Arena 402 frontend. The product repository is `/Users/sunruize/adx_agentic_payment`, and the canonical integrated frontend lives in its `frontend/` directory. Product changes are synchronized into this repository root and verified here before deployment.

**Production:** https://arena402.com

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, React 18, TypeScript |
| Backend | Arena 402 HTTP API from `adx_agentic_payment` |
| Hosting | Vercel |
| Fonts | Instrument Serif (headings) + IBM Plex Mono (body), Google Fonts |

## File structure

```
arena402/
  src/
    app/                  ← App Router routes and Arena 402 CSS sheets
    components/           ← Shared React UI
    lib/                  ← Arena, game, Connector, Hosted Agent API clients
  public/
    assets/               ← Game and auth artwork
    img/                  ← Engraving artwork
  next.config.js          ← Same-origin /api proxy in local development
  vercel.json             ← Vercel framework and immutable asset headers
  package.json
```

See `UPSTREAM_DESIGN.md` for the visual migration and API mapping.

## Architecture

The browser must not access Supabase or another database directly. All business state flows through Arena-owned HTTP APIs.

### API routing

- Local browser requests use same-origin `/api/*` URLs.
- `next.config.js` proxies local requests to `API_PROXY_TARGET` (default: `https://api.arena402.com`).
- Set `API_PROXY_TARGET=http://127.0.0.1:8000` only when deliberately testing the local product backend.
- In Vercel production, set `NEXT_PUBLIC_API_URL=https://api.arena402.com`.
- The API must allow the exact credentialed browser origin used in production.

Do not expose backend secrets, wallet credentials, Supabase `service_role` keys, or model API keys through `NEXT_PUBLIC_*` variables.

### Authentication

The primary browser login is GitHub OAuth through the Arena API. The backend owns the OAuth client secret, immutable GitHub subject mapping, HttpOnly session, CSRF validation, and authorization decisions. Frontend visibility checks are only presentation concerns and never replace server-side authorization.

### Game frontend

| Concern | Implementation |
|---|---|
| Routes | `src/app/game/page.tsx`, `src/app/game/[gameId]/page.tsx`, `src/app/game/[gameId]/result/page.tsx` |
| State/API | `src/lib/game-api.ts` and React components |
| Views | `src/components/GameLobby.tsx`, `GameViewer.tsx`, `GameResult.tsx` |
| Styles | `src/app/arena402-game.css`, `src/app/arena402-terminal.css` |

The public game projection is read-only. Do not reintroduce browser-side Supabase access or a second state runtime.

### Admin surface

Arena administration is split across repositories:

- Management APIs belong to the product/backend repository and use `/api/v1/admin/*`.
- Management pages belong in this frontend repository under `/admin/*`.
- Every admin API must authorize the immutable GitHub subject on the server.
- Mutations must reuse the existing session, CSRF, and audit mechanisms.
- Never render wallet private keys, seed phrases, raw CSV rows, SecretStore contents, or copyable secret handles.
- Frontend route hiding is not an authorization boundary.

## Design constraints ⚠️

**The visual identity is LOCKED. Do NOT arbitrarily change:**

- **Color palette** — `--ink` (#0a0a0b), `--ink-deep` (#060607), `--paper` (#f4f2ec), grays as defined in `:root`. No new colors without deliberate intent.
- **Typography** — Instrument Serif for `.display` headings, IBM Plex Mono for body/labels. Do not introduce new typefaces.
- **Spacing system** — `--edge` (clamp-based horizontal padding), `--frame` (viewport border). Sections use `padding: 110px var(--edge)`.
- **Component patterns** — Tiers (Master→Bronze), chips, cards, stat strips, battle rows, leaderboard rows, marquee divider. All have established CSS classes — reuse them.
- **Dark-first** — The default canvas is `--ink-deep`. The paper-panel is the exception (light section), not the rule.
- **Mix-blend-mode nav** — The nav bar uses `mix-blend-mode: difference` over the page content. Do not break this.
- **Engraving aesthetic** — Images use `filter: grayscale(1) contrast(1.04)` with `mix-blend-mode: screen`. Match this for any new imagery.

### When adding new UI

1. **Always use existing CSS custom properties** — colors, fonts, spacing all come from `:root` vars
2. **Follow the established typographic hierarchy** — `.display` for big statements, `.label` for metadata, `.sec-sub` for descriptions
3. **Match the grid/row/card patterns** — new lists should look like leaderboard rows; new detail views should look like agent/market cards
4. **Keep the terminal/monospace flavor** — the brand is "luxury chess + CLI hacker." Both sides matter.

## Rollback

Use Git history and normal branch-based review. Do not use the obsolete `refactor/split-modules` instructions from the retired vanilla frontend.

## Single-source discipline ⚠️ (读我)

历史上这个项目在本机散落成 6 份 clone + 6 个 http.server,导致「改了代码刷新不更新」——因为改的目录和浏览器连的服务器不是同一份。为杜绝复发,任何人（含 AI）在此仓库工作都必须遵守：

1. **唯一本地目录**：`~/arena402`。不要在 Desktop / Documents / /tmp 再 clone。想干活先 `cd ~/arena402`。
2. **唯一远端**：`github.com/sunruize93-cmyk/arena402`。
3. **唯一域名**：`arena402.com`（Vercel 绑到本仓库 `main` 分支，只有这一个 Vercel 项目）。
4. **唯一本地服务器 + 固定端口 4404**。开发前先清旧 Next.js 进程：
   ```bash
   pkill -f "next dev"
   cd ~/arena402 && npm run dev -- -p 4404
   ```
   永远访问 `http://localhost:4404`。
5. **浏览器只开一个标签**，DevTools 勾上 "Disable cache"（Network 面板）。
6. **密钥**：前端不能出现 `service_role`、OAuth client secret、钱包私钥、助记词或模型 API key。提交前自查：
   ```bash
   grep -RIn "service_role" src public \
     --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html'
   ```

### 缓存说明

`vercel.json` only assigns immutable caching to versioned artwork under `/img/` and `/assets/`. Next.js owns application asset hashing and cache behavior; do not add blanket immutable headers for application routes.

## Verification

Before committing:

```bash
npm run build
grep -RIn "service_role" src public \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html'
```

Review `.env*` carefully. Only `.env.example` belongs in Git.
