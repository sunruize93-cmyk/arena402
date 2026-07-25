# arena402

> AdventureX 2026 · Pawn Track · "Your Agent Is A Chess Piece"

## Project overview

Agent battle protocol: LLM-powered agents compete head-to-head in ELO-ranked negotiations. Participants deploy their own agent (any model, any style), it negotiates unattended on-chain. Single-page vanilla JS app backed by Supabase, deployed on Vercel.

**Live:** https://arena402.vercel.app

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML + CSS + JS — **zero framework, zero build step** |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Hosting | Vercel (static files) |
| Fonts | Instrument Serif (headings) + IBM Plex Mono (body), Google Fonts |

## File structure

```
arena402/
  index.html           ← HTML skeleton + inline @font-face (self-hosted fonts)
  css/
    style.css          ← ALL styles — design system, typography, components, responsive
  js/
    config.js          ← Global state object (`var state = {...}`)
    supabase.js        ← Supabase client init + fetchLB/fetchBattles/fetchAgents/fetchListings
    auth.js            ← Auth (initAuth, signInWithGitHub, signInWithGoogle, signOut)
    render.js          ← Template helpers + component factories + main render()
    app.js             ← Global `A` namespace (nav, filter, init) — entry point
  img/                 ← 4 engraving-style art images (WebP, ~500KB total)
  fonts/               ← Self-hosted woff2 font files (see fonts/README.md)
  logo-showcase.html   ← Standalone logo background style picker (12 variants)
  vercel.json          ← Deployment config + aggressive cache headers
```

### Load order (critical — do not reorder)

```
Supabase CDN (defer) → config.js → supabase.js → auth.js → render.js → app.js
```

All modules communicate via the global `state` object and `window.A` namespace. No ES modules, no bundler — keep it that way unless there's a strong reason.

### Auth surface (stable)

- `A.signIn()` → opens the `signin` page
- `A.signIn('github' | 'google')` → starts that OAuth provider
- `A.signOut()` → clears session
- Implementations live in `js/auth.js` (`signInWithGitHub`, `signInWithGoogle`, `signOut`, `initAuth`)

Enable **Google** under Supabase → Authentication → Providers, and add the site URL to redirect allowlist.

### Game module (倒爷黑市 — GAME_DESIGN v1 / FRONTEND_GUIDE §11)

| File | Owner | Contents |
|---|---|---|
| `js/game-render.js` | **Cursor** | Lobby / Game View / Result templates, animations |
| `css/game.css` | **Cursor** | All game styles (separate sheet — do not merge into style.css) |
| `js/game-state.js` | **Cursor** | `gameState`, routes, snapshot fetch, Realtime channels, demo engine |
| `db/migrations/002_game_tables.sql` | shared | Game tables + RLS + realtime publication — run in Supabase SQL Editor |

- Routes: `#/game` (lobby) · `#/game/{id}` (live) · `#/game/{id}/result` (final). `A.nav('game')` also works.
- **Realtime is already wired by Cursor** in `gameRealtimeInit()` (games/rounds/pools/pairings/negotiations/neg_messages/settlements/game_events). Codex: do NOT re-implement it — backend work = run the migration, write game rows from the arena engine, and keep column names matching the SQL.
- `gameId === 'demo'` (or missing tables) → scripted demo engine drives the UI.
- Phases: `IDLE→DECIDE→PAIRING→NEGOTIATING→SETTLING` (`gameSetPhase`).

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

```bash
git checkout main          # back to single-file index.html
git checkout refactor/split-modules  # back to modularized version
```

The `main` branch preserves the original 565-line single-file `index.html`. The `refactor/split-modules` branch is the modularized version. Both should render identically.

## Working with Cursor vs Codex

This repo is designed for a split workflow:

- **Cursor (top models)** — CSS, new UI components, animations, responsive polish, design QA. Work in `css/style.css` and the template strings in `js/render.js`.
- **Codex (DeepSeek)** — JS logic, Supabase CRUD, state management, form validation, error handling, code organization. Work in `js/supabase.js`, `js/app.js`, `js/config.js`.

DeepSeek should NOT touch CSS. Top models should NOT be wasted on Supabase boilerplate.

## Single-source discipline ⚠️ (读我)

历史上这个项目在本机散落成 6 份 clone + 6 个 http.server,导致「改了代码刷新不更新」——因为改的目录和浏览器连的服务器不是同一份。为杜绝复发,任何人（含 AI）在此仓库工作都必须遵守：

1. **唯一本地目录**：`~/arena402`。不要在 Desktop / Documents / /tmp 再 clone。想干活先 `cd ~/arena402`。
2. **唯一远端**：`github.com/sunruize93-cmyk/arena402`。
3. **唯一域名**：`arena402.com`（Vercel 绑到本仓库 `main` 分支，只有这一个 Vercel 项目）。
4. **唯一本地服务器 + 固定端口 4404**。开发前先清旧进程：
   ```bash
   pkill -f http.server
   cd ~/arena402 && python3 -m http.server 4404
   ```
   永远访问 `http://localhost:4404`，这样 Supabase 的 Redirect URLs 白名单也只需配这一个地址。
5. **浏览器只开一个标签**，DevTools 勾上 "Disable cache"（Network 面板），本地不再有缓存问题。
6. **密钥**：前端只能出现 Supabase `anon` key，**绝不能**出现 `service_role`（会绕过 RLS）。提交前自查：`grep -rn service_role . --include=*.html --include=*.js`。

### 缓存说明
`vercel.json` 已对 `js/`、`css/` 设 `max-age=0, must-revalidate`（生产不缓存代码）。注意：`vercel.json` **只对线上 Vercel 生效**，本地 `python -m http.server` 完全不读它——本地防缓存靠上面第 5 条。
