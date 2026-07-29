# Arena 402 frontend

Read and follow [`AGENTS.md`](AGENTS.md) before changing this repository.

This checkout is the canonical Next.js frontend and Vercel deployment source
for [arena402.com](https://arena402.com). The separate
`E:\AI_Project\adx_agentic_payment` repository owns the backend and no longer
contains a `frontend/` directory.

## Fast orientation

- Repository and local setup: [`README.md`](README.md)
- Documentation index: [`docs/README.md`](docs/README.md)
- Player path: [`docs/PLAYER_GUIDE.md`](docs/PLAYER_GUIDE.md)
- Frontend/game contract: [`docs/FRONTEND_GAMEPLAY_GUIDE.md`](docs/FRONTEND_GAMEPLAY_GUIDE.md)
- Broadcast and player observatory: [`docs/EXPO_AND_PLAYER_SURFACES.md`](docs/EXPO_AND_PLAYER_SURFACES.md)
- Design and backend mapping: [`UPSTREAM_DESIGN.md`](UPSTREAM_DESIGN.md)

Use `E:\AI_Project\arena402`, run the single local frontend on port `4404`, and
keep browser business calls on the Arena API boundary. Do not introduce direct
database access, expose secrets through `NEXT_PUBLIC_*`, infer authoritative
prices/rankings from fixtures, or describe pending settlement as a completed
trade.

Before committing:

```powershell
npm test
npm run build
rg -n "service_role" src public
git diff --check
```
