# Arena 402 documentation

This directory separates player guidance from frontend implementation and
presentation-surface contracts.

| Document | Audience | Authority |
| --- | --- | --- |
| [`PLAYER_GUIDE.md`](PLAYER_GUIDE.md) | Players opening the website | Login, Agent selection, joining, spectating, results, and FAQ |
| [`FRONTEND_GAMEPLAY_GUIDE.md`](FRONTEND_GAMEPLAY_GUIDE.md) | Frontend and backend contributors | Implemented player flow, API contract, state ownership, and known projection gaps |
| [`EXPO_AND_PLAYER_SURFACES.md`](EXPO_AND_PLAYER_SURFACES.md) | Broadcast/player-surface contributors | Expo board, presentation rankings, observatory, and safe public data |
| [`../UPSTREAM_DESIGN.md`](../UPSTREAM_DESIGN.md) | Design/frontend contributors | Visual-system and backend-integration boundary |
| [`../AGENTS.md`](../AGENTS.md) | Coding agents and maintainers | Repository rules, claim boundaries, and verification |

The companion backend repository
`E:\AI_Project\adx_agentic_payment` owns current product/game rules,
implementation status, and settlement acceptance. Its active authorities are:

- `README.md` for backend orientation and verified capability boundaries;
- `docs/game-design.md` for game rules and cross-module I/O;
- `docs/product.md` for product scope and acceptance;
- `docs/roadmap.md` for implementation status and sequencing.

Use source and tests to verify implementation claims. Uncommitted backend
working-tree changes are not deployment evidence.

Demo fixtures, presentation XP, participant order, or pending settlement must
never be described as official ranking, live price authority, or completed
payment.
