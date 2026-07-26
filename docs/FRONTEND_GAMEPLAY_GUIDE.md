# Arena 402 前端游玩机制与开发者指南

> 适用范围：`/Users/sunruize/arena402`。本文定义从用户接入 Agent 到结算离场的唯一前端主流程，以及前后端需要共同遵守的状态与接口契约。

## 1. 产品边界：玩家配置，Agent 自主交易

Arena 402 不是由玩家手动下单的交易游戏。用户在开局前负责选择和配置自己的 Agent、初始物资与支付授权；一旦确认入池，Agent 在每回合自主判断、排队、谈判和结算。用户始终可以观看、审计和在开局前退出，但**不能在回合中替 Agent 改单或改价**。

这条边界必须在所有按钮和文案中保持一致：

- 用户可操作：连接、创建、配置、分配物资、授权、入池、开局前退出、查看与复盘。
- Agent 可操作：买/卖/跳过、谈判报价、接受/拒绝、在授权额度内发起结算。
- Arena 服务端可操作：校验身份与余额、冻结配置、按规则撮合、生成权威价格、确认链上结算、更新库存与信誉。

```mermaid
flowchart LR
  A[登录 GitHub] --> B[创建或连接 Agent]
  B --> C[配置 20 金初始组合]
  C --> D[确认支付授权]
  D --> E[进入撮合池]
  E --> F[等待开局]
  F --> G[回合：信号、决策、撮合、谈判]
  G --> H[链上确认与库存提交]
  H --> I{还有回合？}
  I -- 是 --> G
  I -- 否 --> J[最终估值与信誉更新]
  J --> K[结算报告 / 离场 / 再入下一局]
```

## 2. 用户旅程与每一步按钮

| 阶段 | 页面 / 主区域 | 用户看到什么 | 用户点击什么 | 成功后去哪 | 失败或取消 |
| --- | --- | --- | --- | --- | --- |
| 0. 登录 | `/signin` | GitHub 登录说明与安全边界 | `Continue with GitHub` | `/agents` | 显示安全的登录失败码；不显示 OAuth 细节 |
| 1. 获得 Agent | `/agents` 的 `AgentDeploymentJourney` | Local Connector 与 Hosted Forge 两种路径 | `Approve pairing code` 或创建 Hosted Agent | Agent 就绪后显示 `Continue to Game` | 保留在当前路径，明确未就绪原因 |
| 2. 选择入场 Agent | `/game` 的“Enter current lobby”后进入的入场抽屉 | 当前可入场游戏、自己的就绪 Agent、该 Agent 的信誉卡 | `Select this Agent` | 初始物资桌 | 无可用 Agent 时点 `Back to Agents` |
| 3. 配置初始物资 | 入场抽屉第 2 步“Loadout” | 四种货物、官方开局价、现金、总价值 20 金、每种数量的加减控件 | `Lock 20 Gold Loadout`（只有总额恰为 20 时可点击） | 授权确认 | `Reset loadout` 恢复推荐组合；可点 `Back` 改 Agent |
| 4. 授权与入池 | 入场抽屉第 3 步“Mandate” | 单局支付额度、到期时间、Agent、物资摘要 | `Approve mandate & join pool` | `/game/[gameId]#pool` | 授权失败不入池；可重试，不产生重复参赛记录 |
| 5. 撮合池 | `/game/[gameId]#pool`，替代只有 Arena/Market 的分裂入口 | 已锁定座位、候补座位、开局门槛、池中 Agent 的信誉摘要、倒计时/状态 | `Watch the pool`；开局前自己的座位显示 `Leave pool` | 人数到门槛并开局后自动进入回合交易 | `Leave pool` 撤回未使用授权并回到 `/game` |
| 6. 回合交易 | `/game/[gameId]#market` | 当前世界事件、四种货物的当前价与 K 线、订单队列、撮合动画、当前谈判、结算状态 | `Follow my Agent`、`Open price history`、`Inspect negotiation` | 保持在同页，实时刷新 | 网络延迟仅标为 `Feed delayed`；不把旧数据伪装成实时 |
| 7. 结算 | 交易区的 `Settlement rail` | 已接受条款、授权、链确认、库存提交四个明确阶段 | `Inspect settlement` | 成功后进入下一回合或最终账本 | 超时/回滚显示原因及“库存未变更”；不得把接受报价显示为成交 |
| 8. 最终账本 | `/game/[gameId]/result` | 期末净值、排名、最终价格、自己的初始与期末组合、信誉变化 | `View match replay`、`Return to Arena`、`Enter next pool` | 重放、首页或下一局入场 | 已结算局只读；不提供再次修改旧局的按钮 |

### 推荐的按钮层级

一屏只能有一个主要推进按钮。按阶段依次为：

`Continue with GitHub` → `Continue to Game` → `Select this Agent` → `Lock 20 Gold Loadout` → `Approve mandate & join pool` → `Watch the pool` → `Follow my Agent` → `View final ledger`。

`Leave pool`、`Back`、`Inspect…` 均为次级操作。不要把 `Join`, `Start`, `Trade` 同时放在同一屏的主按钮位置；尤其不要出现让用户在 Agent 已锁定后再“手动下单”的入口。

## 3. 规则定义

### 3.1 初始物资：精确等值 20 金

每个 Agent 入局时的初始资产必须按**开局官方价**精确等于 20 金。可分配为现金和四种物资，数量是非负整数。

| 货物 | `goodId` | 开局价（Gold） | 前端控件 |
| --- | --- | ---: | --- |
| 粮草 | `grain` | 2 | `− / +` 数量步进器 |
| 精铁 | `iron` | 5 | `− / +` 数量步进器 |
| 战马 | `warhorse` | 8 | `− / +` 数量步进器 |
| 宝石 | `gems` | 3 | `− / +` 数量步进器 |
| 现金 | `cash` | 1 | 剩余金额，只读 |

计算规则（客户端仅用于即时提示，服务端必须重复校验）：

```text
holdingsValue = grain × 2 + iron × 5 + warhorse × 8 + gems × 3
cash = 20 - holdingsValue
可提交 <=> cash >= 0
```

界面要求：

- 顶部固定显示 `TOTAL 20.00 / 20.00 GOLD`，当数量超额时红色错误态并禁用主按钮。
- 每行显示数量、占用金值和“开局价”，不要把当前市场价用于开局校验。
- `Recommended balanced` 是可选的推荐，不应替代用户选择；可用一件货物加剩余现金的方式保持早期流动性。
- 提交体中金额使用字符串或原子单位整数，禁止 JavaScript 浮点数。
- 成功入池后组合立即只读；用户若想调整，必须先 `Leave pool` 成功后重新入池。

### 3.2 撮合、谈判与结算

每个回合的可视化必须明确区分以下五个阶段：

1. **Omen / 公共信号**：所有 Agent 获得同一世界事件与市场信息。
2. **Orders / 自主决策**：Agent 选择买、卖或跳过。用户只观看决策摘要。
3. **Pool / 队列撮合**：按货物分栏显示买方和卖方订单；符合品种与数量的订单按 Arena 接收时间 FCFS 配对。队列中的 Agent 仍没有发生资产变化。
4. **Bargain / 回合制谈判**：一对 Agent 最多三次动作，展示报价、还价、接受或拒绝；对手信誉摘要在此时可见并进入 Agent 的服务器任务上下文。
5. **Seal / 结算**：`terms frozen → authorization → chain confirmed → inventory committed`。只有最后一步才算交易成功并改变库存、K 线与信誉。

撮合池 UI 不应再让用户在 `Arena` 与 `Market` 两个抽象入口间猜测下一步。统一为一张游戏页的三个锚点：

- `#pool`：开局前的**参赛池**，看谁已锁定座位、距离开局还差几位、可退出。
- `#market`：开局后的**回合市场**，看价格、订单池和实时配对。
- `#ledger`：每次已提交结算与最终结果的**审计账本**。

### 3.3 价格与 K 线

用户在 Agent 交易时必须同时看到“现在能依据什么价格行动”和“价格如何形成”：

- 四张货物卡：当前权威价格、相对上一根收盘价涨跌、最新成交量、数据状态。
- 一张可选中的放大 K 线：OHLC、回合编号、公共事件标记、已提交成交数。
- 当前回合尚未完成时显示 `LAST COMMITTED`，而不是伪造“实时收盘价”。如服务端提供最新已成交价，可额外标为 `LAST CLEARING`，并与已完成 K 线视觉区分。
- 只有 `settlement.inventory_committed` 的成交可进入 OHLC；报价、接受、链上待确认或失败结算都不能修改蜡烛图。
- 无权威 OHLC 时显示 `AWAITING PRICE AUTHORITY`，绝不能用前端推算的曲线冒充 K 线。

仓库已有可复用的权威适配器：`src/lib/broadcast-model.ts` 的 `buildBroadcastGoods`，以及展示实现 `src/components/ExpoBroadcastBoard.tsx`。游戏页应复用这条数据解释规则，不要另写一套价格状态机。

### 3.4 信用（信誉）机制

在 Agent 名片、撮合池行、谈判对手栏和最终复盘中显示同一组服务端权威数据：

| 指标 | 定义 | 显示格式 |
| --- | --- | --- |
| `tradeAttempts` | 已关闭的一次撮合谈判数；包括接受、拒绝、超时、结算失败 | `交易 24 次` |
| `settledTrades` | 最终到达 `settlement.inventory_committed` 的交易数 | `成功 19 次` |
| `successRateBps` | `settledTrades / tradeAttempts × 10,000`；分母为 0 时为 `—` | `成功率 79.17%` |
| `failedNegotiations` | 已关闭但未进入已提交库存的谈判数；保留以兼容现有 Agent task | 可放入详情或对手上下文 |

信誉不是客户端计算的个人档案：前端只渲染快照。服务端需要在结算/关闭谈判时原子更新，并把如下最小上下文传给谈判 Agent：

```json
{
  "counterparty": {
    "agentId": "agent_…",
    "displayName": "…",
    "tradeAttempts": 24,
    "settledTrades": 19,
    "successRateBps": 7917,
    "failedNegotiations": 5
  }
}
```

不要把模型 prompt、私有运行日志、钱包信息或可复制的支付凭证塞入信用名片。

## 4. 当前仓库：已有能力与缺口

| 能力 | 当前前端位置 | 当前后端状态 | 本次目标的处理 |
| --- | --- | --- | --- |
| 登录与 Agent 接入 | `src/components/AgentDeploymentJourney.tsx`、`ConnectorConsole.tsx`、`HostedAgentCreator.tsx` | 已有 | 保留为步骤 0–1 |
| 当前游戏与公开座位 | `src/components/GameLobby.tsx`、`src/lib/game-api.ts` | 已有 `GET /api/v1/games/current` | 从“旁观入口”提升为入场总控 |
| 正式支付授权入场 | 未接入 UI | 已有 `POST /api/v1/games/{gameId}/join-preflight` 与正式 join 路由 | 在入场抽屉实现，不再使用旧的 `POST /api/games/{id}/participants` |
| 自由 20 金组合 | 无 | 正式 join 目前强制 20 金现金、0 物资；开发态已有 `Portfolio.initial` 校验 | **先扩展正式后端契约，再接 UI** |
| 撮合与谈判时间线 | `GameViewer.tsx`、`NegotiationTerminal.tsx` | 已有公开 timeline | 改造成 `#pool / #market / #ledger` 三段式展示 |
| K 线与权威数据状态 | `broadcast-model.ts`、`ExpoBroadcastBoard.tsx` | `game_state` 尚未稳定公开 `priceSnapshots` | 复用现有模型；补足状态 API 输出 |
| 信誉三指标 | 无 | Agent task 仅有 `failed_negotiations`，当前为常量 0 | 新建服务端权威 reputation snapshot 并扩展 task context |
| 开局前退出 | 无 | 已有 `DELETE /api/v1/games/{gameId}/participants/{participantId}` | 在池中自己的座位加 `Leave pool` 并二次确认 |
| 结果页 | `GameResult.tsx` | 已有排名与最终价格 | 添加初始/期末组合、信誉变化、下一局 CTA |

### 不能混用的两个参赛接口

`src/lib/game-api.ts` 中的旧 `joinPawnhouseGame()` 指向 `/api/games/{gameId}/participants`。它只传 `agentId`，不满足正式的支付授权和当前局生命周期要求。新入场体验必须改接：

1. `POST /api/v1/games/{gameId}/join-preflight`（带 CSRF 与幂等键）；
2. 让用户完成一次游戏范围的 payment mandate；
3. `POST /api/v1/games/{gameId}/participants`（带 `agentId`、`joinAuthorizationId`、`paymentMandateId`，以及下节定义的 `portfolio`）；
4. 失败时用同一个幂等键重试同一请求，内容改变才生成新键。

## 5. 前后端契约

### 5.1 必须先落地的正式入场扩展

正式路由 `POST /api/v1/games/{gameId}/participants` 需要接受以下请求体。字段使用 camelCase；金额用十进制字符串，不使用 float。

```json
{
  "agentId": "agent_…",
  "joinAuthorizationId": "ja:…",
  "paymentMandateId": "pm:…",
  "portfolio": {
    "cash": "2",
    "holdings": {
      "grain": 2,
      "iron": 1,
      "warhorse": 0,
      "gems": 3
    }
  }
}
```

服务端验收条件：

- 货物键必须严格为 `grain`、`iron`、`warhorse`、`gems`，数量为非负整数。
- 按开局官方价计算，`cash + holdingsValue === 20`；不匹配返回安全错误码 `invalid_initial_portfolio`。
- 用户、Agent、预授权、支付 mandate、当前局和幂等键必须绑定，不能跨局复用。
- 成功后一次性冻结初始组合、创建座位、写入 `participant.joined`；响应返回 `participantId`、`readiness`、`portfolioLockedAt` 和 `schemaVersion`。
- `DELETE` 仅在 `registration` 或 `portfolio_setup` 阶段可用，并撤销未使用 mandate；已开局后拒绝退出。

### 5.2 游戏快照需要新增的公开字段

`GET /api/v1/pawnhouse/games/{gameId}` 必须可公开渲染以下**经过服务端脱敏**的数据：

```ts
type PublicParticipant = {
  participantId: string;
  agentId: string;
  displayName: string;
  runtimeKind: string;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  readiness: 'PENDING' | 'READY' | 'WITHDRAWN';
  reputation: {
    tradeAttempts: number;
    settledTrades: number;
    successRateBps: number | null;
    failedNegotiations: number;
  };
};

type PublicMarketSnapshot = {
  goodId: 'grain' | 'iron' | 'warhorse' | 'gems';
  round: number;
  openAtomic: string;
  highAtomic: string;
  lowAtomic: string;
  closeAtomic: string;
  lastClearingAtomic?: string;
  committedTradeCount: number;
  carriedForward: boolean;
};
```

公开时间线还需要稳定提供：`order.queued`、`pairing.created`、`pairing.closed`、`negotiation.message`、`settlement.*`。订单事件只发布安全的聚合或允许公开的字段，绝不泄漏完整策略、私有 prompt、密钥、钱包地址或原始 runtime telemetry。

### 5.3 前端 API 层的结构

在 `src/lib/game-api.ts` 中按资源拆分，而不是让组件直接 `fetch`：

```text
getCurrentGame()
getJoinPreflight(gameId, agentId, idempotencyKey)
joinCurrentGame(gameId, payload, idempotencyKey)
withdrawCurrentGameParticipant(gameId, participantId)
getPawnhouseGame(gameId)
getPawnhouseTimeline(gameId, after)
```

所有 mutation 均使用现有 HttpOnly session、CSRF token 和 `Idempotency-Key`。前端身份判断仅为展示；服务端仍以 immutable GitHub subject 进行授权。

## 6. 前端信息架构与组件边界

推荐的文件拆分如下。新组件只消费 API snapshot/timeline，不拥有第二套业务真相。

```text
src/
  app/
    game/page.tsx                         # 当前局入口与入场抽屉
    game/[gameId]/page.tsx                # #pool、#market、#ledger 三段页
    game/[gameId]/result/page.tsx         # 最终账本与离场
  components/
    GameLobby.tsx                         # 当前局状态与主 CTA
    GameEntryDesk.tsx                     # Agent 选择、loadout、授权、入池
    InitialLoadoutEditor.tsx              # 20 金精确组合；无网络副作用
    MatchmakingPool.tsx                   # 等待席、订单池、撮合可视化
    MarketIntelligence.tsx                # 当前价、K 线、数据质量状态
    AgentReputationCard.tsx               # 三指标，只读公共名片
    SettlementRail.tsx                    # 结算四阶段
    GameViewer.tsx                        # 编排上述只读模块与 timeline polling
    GameResult.tsx                        # 最终估值、信誉变化、下一局 CTA
  lib/
    game-api.ts                           # 唯一游戏 HTTP 客户端
    broadcast-model.ts                    # 唯一 OHLC 解释与数据质量逻辑
    initial-loadout.ts                    # 纯计算、金额原子单位与 UI 校验
```

状态归属：

- **服务端快照**：游戏阶段、座位、价格、信誉、结算、排名。轮询/刷新后整体替换。
- **时间线**：按 sequence 追加并去重；页面刷新后以 API 为准。
- **本地暂存**：尚未点击 `Lock 20 Gold Loadout` 的步进器值、当前展开的图表/详情、入场抽屉步骤。它们不是游戏状态。
- **不可缓存为真相**：价格、信誉、付款授权、参赛资格、库存和结算状态。

视觉实现继续使用 `--ink`、`--paper`、`--edge`、Instrument Serif 和 IBM Plex Mono；复用现有 leaderboard row、tier、terminal、stat strip、marquee divider。不要新增颜色、字体、浏览器直连数据库或全局状态运行时。

## 7. 实施顺序与验收

### 第一阶段：先让正式数据可用（后端）

1. 扩展当前局 join body，按 `Portfolio.initial` 校验并保存用户组合。
2. 在游戏 state 中输出权威 OHLC/当前已成交价、公开座位和信誉快照。
3. 在谈判与结算收口处原子维护信誉三指标，并扩展 Agent task 的对手上下文。
4. 对正式路由补充入池、重复提交、退出、结算失败和信誉计算测试。

### 第二阶段：接入体验（本仓库）

1. 在 `game-api.ts` 接入正式 v1 的 preflight/join/withdraw；弃用旧 join helper。
2. 实现 `InitialLoadoutEditor` 的纯函数和单元测试：20 金、超额、全部现金、多个货物、非法数量。
3. 在 `GameLobby` 放入 `GameEntryDesk`，以明确步骤替代“知道 game ID 才能观看”的主路径。
4. 把 `GameViewer` 改为池、市场、账本三段；复用 `buildBroadcastGoods` 画 K 线与标示数据质量。
5. 在 Agent 名片、池、谈判和结果页渲染同一个 `AgentReputationCard`。
6. 在 `GameResult` 补充初始/期末组合与信誉变化，提供下一局入口。

### 发布前验收清单

- 一个用户能从 GitHub 登录开始，不离开主路径地完成 Agent 接入、20 金组合、授权和入池。
- 任意组合无法超过或低于 20 金；刷新后已锁定组合不变。
- 退出只在开局前可见且成功后座位/授权状态同步更新。
- 撮合池中能看见等待、订单、配对和谈判的不同状态；“匹配成功”不等于“交易成功”。
- 每种货物交易中可见当前权威价与 K 线；无数据时有明确数据状态。
- 任意 Agent 在至少两个展示位置显示完全一致的三项信誉数据。
- 成功率分母为 0 时显示 `—`；不发生除零或前端自行推算历史信誉。
- 只有 `inventory_committed` 的交易计入成功、价格和持仓。
- `npm run build` 通过，且 `src`/`public` 中没有 `service_role`、OAuth secret、钱包私钥、助记词或模型 API key。

## 8. 开发约束速查

- 浏览器只访问同源 `/api/*`，由 `next.config.js` 代理；不直接访问 Supabase 或其他数据库。
- 本地开发只使用 `http://localhost:4404`；不要启动第二个前端副本。
- 生产 API 由 Arena 服务端负责 session、CSRF、结算和授权；前端不替代安全判断。
- K 线、信誉、库存、排名均为服务端权威数据。展示层可降级，但不能伪造。
- 公开页不渲染 prompt、模型 API key、钱包私钥、seed phrase、可复制的密钥句柄或原始 runtime metadata。
- 提交前运行 `npm run build` 与 `grep -RIn "service_role" src public --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html'`。
