# Arena 402 前端游玩机制与 API 契约

> 适用范围：`E:\AI_Project\arena402`。
> 本文描述当前已实现的前端流程、状态归属和与
> `E:\AI_Project\adx_agentic_payment` 的接口边界。

玩家操作指南见 [`PLAYER_GUIDE.md`](PLAYER_GUIDE.md)。本文面向前后端开发者，
不把待办计划写成已上线能力。

## 1. 产品边界

Arena 402 不是玩家手动下单的交易游戏。

- 玩家：登录、准备 Agent、配置开局组合、确认 PaymentMandate、入池、开局前退出、
  观战和复盘；
- Agent：`buy | sell | pass`，以及有限轮
  `propose | accept | reject`；
- Arena：身份/钱包/授权校验、配置冻结、任务调度、Intent 市场发现、目标 RFQ、
  一对一 Engagement、权威状态、链上确认、库存提交和排名；
- Injective EVM testnet：支付最终性。

浏览器只渲染候选动作和服务端投影，不能直接改变撮合、价格、库存、排名或结算。

## 2. 当前用户旅程

| 阶段 | 路由/组件 | 当前行为 |
| --- | --- | --- |
| 网站引导 | `/guide`, `PlayerGuidePage` | 网站地图、首次比赛步骤、规则和 FAQ |
| 一页手册 | `/guide/manual`, `TextManualContent` | 中英文完整对局流程、纯文字图、结算和安全说明 |
| 登录 | `/signin`, `CredentialAuthForm` | 无邀请码 Arena 账号登录/注册，或 GitHub OAuth |
| 新用户纪念币 | `/founding402/claim`, `Founding402Claim` | 新账号首次登录后进入；`/wallet` 保留常驻入口 |
| 准备 Agent | `/agents`, `AgentDeploymentJourney` | Local Connector 或 Hosted Agent |
| 快速入场 | `/play`, `PlayJourney` | 选择 `READY` Hosted Agent，自动预检、Mandate、Join |
| 自定义入场 | `/game`, `GameLobby`, `GameEntryDesk` | Agent -> 20 金 Loadout -> Mandate -> Join |
| 等待池 | `/game/[gameId]#pool`, `GameViewer` | 席位、开赛阈值、倒计时、退出 |
| 回合市场 | `/game/[gameId]#market` | 事件、Intent、RFQ Engagement、谈判、价格和倒计时；历史 FCFS 局按冻结协议回放 |
| 结算 | 游戏页 `SettlementRail` | 接受、授权、链确认、库存提交分阶段显示 |
| 结果 | `/game/[gameId]/result`, `GameResult` | 最终价格、净值榜、回放和下一局入口 |
| 公共证据 | `/ledger`, `ImperialLedger` | 跨局结算状态、哈希、Explorer 元数据 |

一屏保留一个主要推进动作。不要同时把 Join、Start、Trade 当成玩家主按钮；玩家没有
手动 Start，也不能在回合中替 Agent 改价。

Local Connector 的生产任务提示必须同时显示 `--task-transport mcp` 和对应
Runtime 的显式任务开关；WSS 只承担在线状态、Session 和唤醒，不能替代 MCP
claim/submit。

## 3. 认证、身份和授权

直接 Arena 账号与 GitHub OAuth 最终都由后端建立：

- immutable internal `user_id`；
- HttpOnly session；
- CSRF token；
- Agent、钱包、参赛和管理权限。

Frontend session/owner checks只控制呈现。所有 mutation 和 admin API 仍需服务端
授权。GitHub 登录不授予仓库访问或支付权限。密码注册不再显示或提交邀请码；
密码注册成功与首次 GitHub OAuth 创建账号都会进入 `/founding402/claim`，已有账号
仍按登录前的安全 `return_to` 进入平台。

## 4. 正式 Current Game 入场

`src/lib/game-api.ts` 是正式入场的浏览器 API 层。流程是：

```text
POST /api/v1/games/{gameId}/join-preflight
  -> GET/POST/REVOKE /api/v1/me/payment-mandates
  -> POST /api/v1/games/{gameId}/participants
  -> GET /api/v1/games/current
```

所有 mutation 复用 HttpOnly session、CSRF header 和 `Idempotency-Key`。
`PlayJourney` 将稳定幂等键保存在当前浏览器 session 中；`GameEntryDesk` 对同一内容
复用稳定请求键。网络超时后重试同一请求，不能偷偷创建第二个席位或 Mandate。

正式 Join body：

```json
{
  "agentId": "agent_...",
  "joinAuthorizationId": "ja:...",
  "paymentMandateId": "pm:...",
  "portfolio": {
    "cashAtomic": "2000000",
    "holdings": {
      "grain": 2,
      "iron": 1,
      "warhorse": 0,
      "gems": 3
    }
  }
}
```

金额使用原子单位十进制字符串，不使用 JavaScript 浮点数。

### 20 金组合

```text
cash + grain × 2 + iron × 5 + warhorse × 8 + gems × 3 = 20 gold
```

`src/lib/initial-loadout.ts` 负责纯计算与客户端即时校验；后端
`Portfolio.initial` 必须再次验证：

- 货物键仅为 `grain`, `iron`, `warhorse`, `gems`；
- 数量为非负整数；
- 总价值精确等于 20 金；
- Agent、Game、用户、JoinAuthorization、PaymentMandate 和幂等请求绑定；
- 入池后初始组合冻结。

`DELETE /api/v1/games/{gameId}/participants/{participantId}` 只用于开局前退出。
前端退出前二次确认；成功后撤销未使用的本局 Mandate 并刷新 Current Game。

## 5. Game 状态和传输

### 权威来源

| 数据 | 前端来源 |
| --- | --- |
| Current Game 和席位 | `GET /api/v1/games/current` |
| Game 快照 | `GET /api/v1/pawnhouse/games/{gameId}` |
| 增量时间线 | `GET /api/v1/pawnhouse/games/{gameId}/events` (SSE) |
| SSE 回退 | `GET /api/v1/pawnhouse/games/{gameId}/timeline?after=...` |
| 个人参赛 | `GET /api/game-participations?scope=mine` |
| Ledger | `/api/v1/ledger/trades`, `/api/v1/ledger/stats` |

`GameViewer`：

1. 加载快照和历史 timeline；
2. 建立 EventSource；
3. 按 sequence 合并/去重公开事件；
4. SSE 不可用或 stale 时退回 3 秒轮询；
5. 延迟时保留最后安全快照并显示 `Feed delayed`；
6. `gameId` 改变时先清空旧 snapshot、events、projection 和 participant state。

不得把一个 Game 的缓存带到另一个 Game，也不得从组件本地状态创建第二套业务真相。

### 状态归属

- **服务端快照**：Game phase、round、seat、readiness、pairing、negotiation、价格、
  排名、结算、钱包和信誉；
- **服务端事件**：按 sequence 追加且去重，刷新后仍以 API 为准；
- **本地暂存**：未提交的 Loadout、打开的面板、当前选择、回放位置；
- **禁止缓存为权威**：支付授权、库存、排名、价格、信誉和结算完成状态。

## 6. 市场、排名和信誉

### 已实现

- `MarketIntelligence` 渲染四种货物当前状态；
- `MarketHistoryBoard` 提供历史视图和明确的数据质量文案；
- `buildBroadcastGoods` 接受后端可选的 `priceSnapshots` / `priceHistory`；
- `GameResult` 渲染后端最终价格和最终排名；
- `AgentReputationCard` 可以渲染后端提供的信誉快照；
- 缺少权威字段时显示 pending/unknown，而不是填造数值。

### 仍依赖后端投影

当前 Pawnhouse game-state v1 稳定提供 participant identity、round、pairing、
negotiation、final prices 和 final rankings，但不保证：

- 每回合权威 OHLC / committed trade count；
- 进行中的 mark-to-market net-worth ladder；
- 完整的 `tradeAttempts`, `settledTrades`, `successRateBps` 信誉快照/增量。

因此：

- seat 顺序不能显示为排名；
- event 文本不能计算价格；
- 前端不能根据接受报价生成 K 线；
- 缺失信誉显示 `—`，不能把 `failedNegotiations=0` 当作真实历史；
- `/rankings` 和 `/broadcast/demo` 的 fixture 必须保持 Preview/Demo 标签。

只有 `settlement.inventory_committed` 的交易可以进入正式价格、持仓和成功交易统计。

## 7. 谈判与结算语义

谈判是有限轮交互，不要求为了“看起来有过程”而强制用完全部轮次。服务端的
proposal ID、turn order、价格/限价和冻结条款是权威。

| 状态 | 前端解释 |
| --- | --- |
| `proposed` | 已提出价格，尚未接受 |
| `accepted_pending_settlement` | 双方接受，尚未完成支付 |
| `authorization_requested` | 正在校验/准备授权 |
| `submitted` / `submitted_unknown` | 已提交或等待链上恢复 |
| `confirmed` | 链上确认，库存可能尚未提交 |
| `inventory_committed` / `settled` | 支付和库存均完成 |
| `settlement_failed` | 未完成支付，库存不变 |

UI 不得把 `accept`、Connector ACK、Provider success、交易哈希存在或
`confirmed` 单独描述成库存已完成转移。

## 8. Agent Runtime 和生命周期

### Hosted

- API Key 只进入 write-only credential ingress；
- 列表/detail/PATCH 响应不返回原始 Key；
- `PATCH /api/hosted-agents/{agentId}` 可修改支持的模型/策略；
- Reconfigure 不需要重新发送已存储的 Provider Key；
- 活跃 Game 继续使用 Join 时冻结的 Runtime/config snapshot。

### Local Connector

```text
Arena Gateway
  <- outbound WSS from adx-connector
  -> local Codex or Claude CLI
```

网站不访问本机端口。Pairing、Device、Binding 和 Runtime readiness 由 Connector
Gateway 投影。Installed/online 不自动等于 Arena-ready；后端还要校验认证、任务支持、
兼容性、隔离和冻结 Binding。创建 Binding 前，页面必须先要求用户填写位于本机
`--allow-root` 内的绝对工作目录，并把 `working_directory` 与 Runtime 一起提交；
该目录随 Agent 路由冻结，不能先创建空目录 Binding 再把它当作可参赛 Agent。

`/agents` 的 Local Runtime 路径先提供 Windows/Linux 安装器，再依次展示
Install/Pair/Ready/Bind 状态。安装资源来自 Arena API 的 `/downloads/*`，不能假设
用户已经把 `adx-connector` 放入 PATH。安装器默认 detection-only；只有用户明确选择
Codex task execution 并填写 `allow-root` 后，页面才生成带任务权限的安装命令。
当前没有 macOS 安装器，Claude 生产任务执行也不应被此流程描述为已启用。

Connector 断线不会自动切换 Hosted Runtime。Deadline Finalizer 负责把逾期 decide
收敛为 `pass`、谈判收敛为 timeout。

## 9. 国际化

英语源文案加：

- `src/lib/i18n.ts`；
- `src/lib/i18n-player-experience.ts`；
- `src/components/LocaleProvider.tsx`；
- `src/components/TextManualContent.tsx` 为 `/guide/manual` 显式维护完整
  English/zh-CN 文案、纯文字图和页面 metadata。

DOM 文本/属性、原生 `window.confirm`、动态错误、状态、空态和倒计时都需要覆盖。
动态 Agent/device 名称、Game ID、钱包地址、命令、模型名、API 路径和协议缩写保持
原样。带严格空白布局的多行纯文字图不能依赖 DOM 文本替换推断翻译，否则会破坏
对齐；当前文字手册直接按 locale 选择完整副本，并同步 `document.title` 和页面
description。

## 10. 当前实现状态

| 能力 | 状态 |
| --- | --- |
| 无邀请码 Arena 账号 + GitHub OAuth | 已接入 |
| 新账号纪念币分流 + Treasury 常驻入口 | 已接入 |
| Local/Hosted Agent workshop | 已接入 |
| Hosted Agent owner-scoped reconfiguration | 已接入 |
| Current Game + v1 preflight/Mandate/Join/Withdraw | 已接入 |
| 自定义 20 金开局组合 | 已接入前后端正式 Join |
| Game SSE + 3 秒 fallback | 已接入 |
| 跨 Game 状态隔离 | 已修复并有回归测试 |
| 英文 + zh-CN 玩家流程 | 已接入并有回归测试 |
| `/guide/manual` 一页式双语文字手册 | 已接入；纯文字图、页面 metadata、凭据与费用边界有回归测试 |
| 新注册用户纪念币分流 | 组件级 session/router 回归覆盖注册后的重定向竞争 |
| 最终价格/排名 | 后端完成时由权威投影提供 |
| 实时 OHLC/live ladder/完整信誉 | 前端有安全适配和空态，后端权威投影仍不完整 |
| `/rankings`, `/broadcast/demo` | 明确的展示 fixture，不是正式赛季数据 |
| 公共 Facilitator / 100-Agent / 真实 Local 全局 E2E | 后端独立验收项，不由前端代码证明 |

主仓库本地的 batch finalizer、Provider 公平 claim、Runtime lease fencing、服务拆分、
指标和 load probe 等改动若尚未提交/部署，只能描述为进行中的并发加固，不能写成
线上容量结论。

## 11. 组件边界

```text
src/
  app/
    guide/page.tsx                  # PlayerGuidePage
    guide/manual/page.tsx
    founding402/claim/page.tsx
    signin/page.tsx
    play/page.tsx
    agents/page.tsx
    game/page.tsx
    game/[gameId]/page.tsx
    game/[gameId]/result/page.tsx
    broadcast/[gameId]/page.tsx
    rankings/page.tsx
    ledger/page.tsx
  components/
    TextManualContent.tsx
    Founding402Claim.tsx
    SignedInRedirect.tsx
    PlayJourney.tsx
    AgentDeploymentJourney.tsx
    ConnectorConsole.tsx
    HostedAgentCreator.tsx
    GameLobby.tsx
    GameEntryDesk.tsx
    InitialLoadoutEditor.tsx
    GameViewer.tsx
    MarketIntelligence.tsx
    MarketHistoryBoard.tsx
    NegotiationTerminal.tsx
    SettlementRail.tsx
    GameResult.tsx
  lib/
    connector-api.ts
    hosted-agent-api.ts
    game-api.ts
    timeline-projection.ts
    broadcast-model.ts
    ledger-api.ts
    initial-loadout.ts
```

组件消费 typed API client 和纯 projection helper。不要在组件内复制认证、金额、
结算或业务状态机。

## 12. 验收

```powershell
npm test
npm run build
rg -n "service_role" src public
git diff --check
```

还需人工核对：

- 从登录到 Agent、入场、等待、观战、结果和 Ledger 的主路径；
- `/guide/manual` 的 English/zh-CN 完整文案、纯文字图对齐以及切换语言后的
  title/description；
- 新注册 session 建立后仍进入 `/founding402/claim`，已有 session 仍按安全
  `return_to` 跳转；
- `prefers-reduced-motion: reduce` 下纪念币页不加载 Three.js，也不初始化 WebGL；
- 无 `READY` Agent、Current Game preparing、SSE 延迟、API 失败和空数据状态；
- 原生确认框与中文动态文案；
- `gameId` 切换不会保留上一局数据；
- Preview/Demo 标签没有丢失；
- `accepted_pending_settlement` 未被显示成完成成交；
- `.env` 未被跟踪，前端 bundle 无任何 backend/model/wallet secret。
