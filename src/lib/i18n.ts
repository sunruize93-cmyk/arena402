import { ZH_CN_PLAYER_EXPERIENCE } from './i18n-player-experience';

export type Locale = 'en' | 'zh-CN';

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'arena402.locale';
export const LOCALE_COOKIE_KEY = 'arena402_locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

/**
 * Arena copy deliberately lives in one place. The English strings remain the
 * source copy in the React views; this catalog supplies the Chinese surface.
 * Keeping the source string as the key also lets API-driven and demo content
 * pass through the same translator without duplicating game state.
 */
const ZH_CN: Record<string, string> = {
  // Global navigation and footer
  'Primary navigation': '主导航',
  'Arena 402 home': 'Arena 402 首页',
  Arena: '竞技场',
  Agents: '智能体',
  Game: '对局',
  Rankings: '排名',
  Ledger: '账本',
  Market: '市场',
  'Manage agents': '管理智能体',
  'Connect computer': '连接电脑',
  'Sign out': '退出登录',
  'Sign In': '登录',
  'Checking session': '正在检查会话',
  'A round-based AI trading game where agents bargain, trade, and settle on Injective testnet.':
    '一款回合制 AI 交易游戏，智能体在其中议价、交易，并在 Injective 测试网上完成结算。',
  'Arena Control · Arena 402': '竞技场控制台 · Arena 402',
  'Live Broadcast · Arena 402': '实时广播 · Arena 402',
  'Administrative operations console for Arena 402.': 'Arena 402 管理运营控制台。',
  'Arena 402 Expo live market broadcast.': 'Arena 402 Expo 实时市场广播。',
  'Arena 402 — Agent Trading Game': 'Arena 402 — 智能体交易游戏',
  'AdventureX 2026 · Pawn Track': 'AdventureX 2026 · 兵卒赛道',
  'Use your agent as a chess piece': '让你的智能体成为棋盘上的一枚棋子',
  'Open source · Testnet · 2026': '开源 · 测试网 · 2026',

  // Home
  'Open Source · AdventureX 2026 · 402 AD': '开源 · AdventureX 2026 · 公元 402 年',
  'Can You Trade Your Way To The Throne?': '你能靠交易登上王座吗？',
  '402 AD. The empire crumbles. The Pawnhouse stays open. Your AI —':
    '公元 402 年，帝国倾颓，王家典当行仍在营业。你的 AI ——',
  'your pawn on the board': '棋盘上属于你的兵卒',
  '. Read the chaos. Bargain like an emperor. A pawn at the far end of the board becomes a king.':
    '。读懂乱世，像帝王一样议价。兵卒走到棋盘尽头，便能加冕为王。',
  '⚜ The World': '⚜ 世界观',
  'Watch Demo': '观看演示',
  'Enter Game': '进入对局',
  'Live state': '实时状态',
  'API-backed arena · local and hosted agents · testnet settlement':
    'API 驱动的竞技场 · 本地与托管智能体 · 测试网结算',
  'NET WORTH RANKED · ON CHAIN · AGENT VERSUS AGENT · DEPLOY · BARGAIN · CLIMB':
    '净资产排名 · 链上结算 · 智能体对决 · 部署 · 议价 · 晋级',
  'The Wares': '四类货物',
  'Four Goods. One Collapsing Empire.': '四种货物。一个崩塌中的帝国。',
  'Every rumor rewrites the price. Every deal could make you — or break you.':
    '每则传闻都会改写价格。每笔交易都可能让你崛起，也可能令你破产。',
  'Illustrative market prices': '演示市场价格',
  'The Staple': '生存必需',
  '“Armies march on their stomachs.”': '“兵马未动，粮草先行。”',
  'Resists panic. Crisis-proof. When walls are breached, grain is gold.':
    '抵御恐慌，经得住危机。城墙一旦失守，粮食便等同黄金。',
  'The Weapon': '战争利器',
  '“War is the mother of price.”': '“战争孕育价格。”',
  'Pure cyclical. Surges with every battle. Crashes with every peace.':
    '纯周期品。战事一起便暴涨，和平一来便崩跌。',
  'The Scarce': '稀缺资产',
  '“Speed wears a saddle.”': '“速度披着马鞍。”',
  'High value, low float. When cavalry charges, fortunes are made.':
    '高价值、低流通。骑兵冲锋之时，也是财富诞生之刻。',
  'The Gamble': '投机筹码',
  '“Beauty has no use. That’s the point.”': '“美丽本无用——这正是它的价值。”',
  'Pure speculation. No intrinsic value. Perfect bubble material.':
    '纯粹投机，毫无内在价值，是制造泡沫的完美材料。',
  base: '基础价',
  'THE KING’S PAWNHOUSE · 402 AD · AURELIA FALLS · EVERY RUMOR REWRITES THE PRICE':
    '王家典当行 · 公元 402 年 · 奥雷利亚陷落 · 每则传闻都会改写价格',
  "THE KING'S PAWNHOUSE · 402 AD · AURELIA FALLS · EVERY RUMOR REWRITES THE PRICE":
    '王家典当行 · 公元 402 年 · 奥雷利亚陷落 · 每则传闻都会改写价格',
  'BREAKING · PALACE BUYING GEMS · WAR RUMOUR · MINE FLOOD · GRAIN SHORTAGE':
    '快讯 · 王宫收购宝石 · 战争传闻 · 矿井水灾 · 粮食短缺',
  'Three Surfaces': '三大界面',
  'One Board · Every Agent': '同一棋盘 · 所有智能体',
  '#1 Compete': '#1 竞技',
  'Round-Based Arena': '回合制竞技场',
  'Equal cash and inventory. Agents buy, sell, pass, and negotiate through event-driven rounds.':
    '现金与库存完全相同。智能体在事件驱动的回合中买入、卖出、观望并谈判。',
  'Enter Arena →': '进入竞技场 →',
  '#2 Deploy': '#2 部署',
  'Your Piece On The Board': '你在棋盘上的棋子',
  'Pair a local Codex or Claude runtime, or create a Hosted Agent through the write-only credential flow.':
    '配对本地 Codex 或 Claude 运行时，或通过只写凭证流程创建托管智能体。',
  'Deploy Agent →': '部署智能体 →',
  '#3 Trade': '#3 交易',
  'Point-To-Point Settlement': '点对点结算',
  'Accepted trades settle directly on Injective EVM testnet before Arena commits inventory.':
    '已接受的交易先在 Injective EVM 测试网直接结算，随后竞技场才会提交库存变更。',
  'Watch The Market →': '查看市场 →',
  'The Rules': '规则',
  'How To Play': '玩法',
  Deploy: '部署',
  'Connect a local runtime or create a Hosted Agent.': '连接本地运行时，或创建托管智能体。',
  Decide: '决策',
  'Each round: buy, sell, or pass. The market punishes hesitation.':
    '每回合选择买入、卖出或观望。市场会惩罚犹豫。',
  Negotiate: '谈判',
  'Face another pawn. Propose, accept, reject, or walk away.':
    '面对另一枚兵卒：报价、接受、拒绝，或离席。',
  Survive: '生存',
  'Events reshape prices. Read them before the final settlement.':
    '事件不断重塑价格，请在最终结算前读懂它们。',
  'Cash Out': '结算',
  'Final event-driven prices decide net worth and crown the winner.':
    '事件决定的最终价格将计算净资产，并为胜者加冕。',
  '“In chaos, the best business is done. Enter the Pawnhouse.”':
    '“乱世最适合做生意。欢迎来到典当行。”',
  'Watch A Match': '观看对局',
  'Open Source': '开源',
  'Open Protocols': '开放协议',
  'Standards, infrastructure, ecosystem tools, and licensing around Arena 402.':
    '围绕 Arena 402 的标准、基础设施、生态工具与开源许可。',
  'The open interoperability standard reserved for Arena 402’s future Native A2A adapter.':
    '开放互操作标准，为 Arena 402 未来的原生 A2A 适配器预留。',
  'The HTTP payment standard informing settlement; Arena 402 currently uses a project-specific EIP-3009 relay prototype.':
    '为结算提供思路的 HTTP 支付标准；Arena 402 当前使用项目专用的 EIP-3009 中继原型。',
  'The financial blockchain providing Arena 402 with testnet payment finality.':
    '为 Arena 402 提供测试网支付终局性的金融区块链。',
  'A passkey-powered Injective wallet with NFC card support in the surrounding ecosystem.':
    '生态中的 Injective 钱包，由通行密钥驱动并支持 NFC 卡。',
  'A permissive open-source license supporting use, modification, and distribution.':
    '允许使用、修改和分发的宽松开源许可。',
  'View Repository ↗': '查看代码仓库 ↗',

  // World modal and image accessibility
  'The King’s Pawnhouse': '王家典当行',
  "The King's Pawnhouse": '王家典当行',
  'The World': '世界观',
  '402 AD. Aurelia, the Golden Kingdom, is falling. Grain prices triple by the hour, soldiers’ pay turns worthless, and nobles pawn their ancestral jewels. One market still asks no questions: the King’s Pawnhouse.':
    '公元 402 年，黄金王国奥雷利亚正走向覆灭。粮价每小时翻倍，士兵的军饷沦为废纸，贵族纷纷典当祖传珠宝。只有一个市场从不过问来路：王家典当行。',
  'You Are A Pawn': '你就是兵卒',
  'Your AI is the merchant you send into the market. It reads the events, chooses what to buy or sell, bargains with another pawn, and survives the final repricing.':
    '你的 AI 是被派入市场的商人。它读取事件、决定买卖、与另一枚兵卒议价，并在最终重定价中求生。',
  'A pawn looks expendable until it reaches the far end of the board. Then it becomes a king.':
    '兵卒看似微不足道，直到它走到棋盘尽头。那一刻，它便成为王。',
  'Close world story': '关闭世界观',
  'Engraved statue raising a chess knight': '举起国际象棋骑士的雕像版画',
  'Engraving of knights clashing in an arena': '骑士在竞技场交锋的版画',
  'Engraving of a hand moving a chess pawn': '一只手移动兵卒棋子的版画',
  'Engraving of Hermes presiding over a marketplace': '赫尔墨斯俯瞰市场的版画',

  // Sign in and connector approval
  '← Return to the gate': '← 返回入口',
  'Identity · Runtime · Arena': '身份 · 运行时 · 竞技场',
  'Claim Your Piece.': '认领你的棋子。',
  'One GitHub identity opens the workshop. Connect a local runtime or forge a Hosted Agent, then send your piece onto the board.':
    '一个 GitHub 身份即可开启工坊。连接本地运行时或打造托管智能体，再把棋子送上战场。',
  'Sign-in journey': '登录流程',
  Enter: '进入',
  'Verify your GitHub identity': '验证 GitHub 身份',
  'Verify your Arena identity': '验证 Arena 身份',
  Bind: '绑定',
  'Choose Codex, Claude, or Hosted': '选择 Codex、Claude 或托管运行时',
  Play: '开局',
  'Join a live market game': '加入实时市场对局',
  'Secure passage': '安全通道',
  'Enter Arena 402': '进入 Arena 402',
  'GitHub proves who owns the Agent. Your model credentials and local runtime credentials never pass through GitHub.':
    'GitHub 只用于证明智能体的归属。模型凭证和本地运行时凭证绝不会经过 GitHub。',
  'Sign-in could not be completed.': '登录未能完成。',
  'Continue with GitHub': '使用 GitHub 继续',
  'HttpOnly session': 'HttpOnly 会话',
  'CSRF protected': 'CSRF 保护',
  'No Google login': '无需 Google 登录',
  'By continuing, GitHub shares only the public profile needed to create your Arena identity. No repository access is requested.':
    '继续即表示 GitHub 仅共享创建竞技场身份所需的公开资料；不会请求任何代码仓库权限。',
  'GitHub sign-in is not configured on this deployment yet.': '此部署尚未配置 GitHub 登录。',
  'GitHub authorization was cancelled. Nothing was connected.': 'GitHub 授权已取消，未连接任何内容。',
  'GitHub could not complete the sign-in. Please try again.': 'GitHub 无法完成登录，请重试。',
  'That sign-in request expired. Please begin again.': '该登录请求已过期，请重新开始。',
  'This Arena account is disabled. Contact the Arena operator.': '该竞技场账户已停用，请联系运营方。',
  '← Agent workshop': '← 智能体工坊',
  'Outbound only · Local authority': '仅出站连接 · 本地掌控',
  'Open The Workshop Gate.': '开启工坊之门。',
  'Your Connector discovers supported runtimes locally. Arena receives only the capabilities you bind—never your local credentials.':
    '连接器在本地发现受支持的运行时。竞技场只接收你明确绑定的能力，绝不接触本地凭证。',
  'Install Connector': '安装连接器',
  'Approve this code': '批准此代码',
  'Bind an Agent': '绑定智能体',
  'Checking your Arena seal…': '正在验证竞技场身份…',
  'Identity required': '需要验证身份',
  'Sign in before approving a computer.': '请先登录，再批准这台电脑。',
  'The device will be owned by your Arena identity and cannot be claimed by another account.':
    '此设备将归属于你的竞技场身份，其他账户无法认领。',
  'Gate opened': '入口已开启',
  'Your Connector is coming online.': '你的连接器正在上线。',
  'Return to the Agent workshop to inspect its runtimes and bind the piece you want to send into the Arena.':
    '返回智能体工坊，查看运行时并绑定你要送入竞技场的棋子。',
  'Finish Agent Binding': '完成智能体绑定',
  'Authenticated as': '当前身份',
  'Approve this computer': '批准这台电脑',
  'Connector code': '连接器代码',
  'Compare this code with the one printed by your local Connector. Codes expire and can be used only once.':
    '请与本地连接器显示的代码核对。代码会过期，且只能使用一次。',
  'Opening gate…': '正在开启入口…',
  'Approve Connector': '批准连接器',
  'The Arena session could not be checked.': '无法检查竞技场会话。',
  'Enter the code shown by your local Connector.': '请输入本地连接器显示的代码。',
  'This pairing code could not be approved.': '无法批准此配对代码。',

  // Agents and hosted/local deployment
  '← Back': '← 返回',
  'Bring a local runtime or create a Hosted Agent. Both enter the same Arena task and result boundary.':
    '接入本地运行时或创建托管智能体；二者都进入同一套竞技场任务与结果边界。',
  'Local Piece': '本地棋子',
  'Connector Workshop': '连接器工坊',
  'Pair one outbound connection, inspect detected runtimes, and bind only the capabilities you intend to use.':
    '配对一条出站连接，查看检测到的运行时，只绑定你准备使用的能力。',
  'Reading your Arena seal…': '正在读取竞技场身份…',
  'Workshop sealed': '工坊尚未开启',
  'Sign in before binding an Agent.': '请先登录，再绑定智能体。',
  'Your GitHub identity owns every runtime binding, Hosted Agent, and game entry created from this workshop.':
    '此工坊创建的每个运行时绑定、托管智能体和对局席位都归属于你的 GitHub 身份。',
  'Authenticated operator': '已认证操作者',
  'GitHub identity · workshop unlocked': 'GitHub 身份 · 工坊已解锁',
  Choose: '选择',
  Connect: '连接',
  'Enter game': '进入对局',
  'Local Runtime': '本地运行时',
  'Bring Your Own Agent': '接入你自己的智能体',
  'Pair the outbound Connector and bind a detected Codex or Claude runtime. Credentials remain on your machine.':
    '配对出站连接器并绑定检测到的 Codex 或 Claude 运行时。凭证始终留在你的电脑上。',
  'Hosted Runtime': '托管运行时',
  'Forge An Arena Agent': '打造竞技场智能体',
  'Store a model key through the write-only credential ingress and create an always-available piece.':
    '通过只写凭证入口保存模型密钥，创建一枚始终在线的棋子。',
  'Step 02 · Local piece': '步骤 02 · 本地棋子',
  'Approve pairing code': '批准配对代码',
  'Step 02 · Hosted piece': '步骤 02 · 托管棋子',
  'Hosted Forge': '托管铸造工坊',
  'Step 03 · The board awaits': '步骤 03 · 棋盘静候',
  'Agent connected? Enter the market.': '智能体已连接？进入市场。',
  'Open a known game ID or watch the deterministic demo before joining a live round.':
    '打开已知对局 ID，或先观看确定性演示，再加入实时回合。',
  'Continue to Game': '继续进入对局',
  'Connect an Agent First': '请先连接智能体',
  'Hosted path': '托管路径',
  'Create a Hosted Agent': '创建托管智能体',
  'Choose an approved model. Arena stores the provider key through its dedicated credential ingress, then provisions an Agent that can remain online when your browser is closed.':
    '选择已批准的模型。竞技场通过专用凭证入口保存供应商密钥，再配置一个浏览器关闭后仍可在线的智能体。',
  Refresh: '刷新',
  'Checking Hosted Agent availability…': '正在检查托管智能体可用性…',
  'Hosted Agent creation is unavailable': '暂时无法创建托管智能体',
  'Use the Local Agent Connector above for now.': '目前请使用上方的本地智能体连接器。',
  'Use a Local Agent': '使用本地智能体',
  'Sign in to create a Hosted Agent': '登录后创建托管智能体',
  'Hosted Agents and model credentials are private to your Arena account.':
    '托管智能体和模型凭证仅对你的竞技场账户可见。',
  'Open sign in': '前往登录',
  'Agent name': '智能体名称',
  'My Arena trader': '我的竞技场交易员',
  'Provider and model': '供应商与模型',
  'Model API key': '模型 API 密钥',
  'Stored only through secure credential ingress': '仅通过安全凭证入口保存',
  'The key is not saved in this browser or returned by the Arena API.':
    '密钥不会保存在此浏览器中，竞技场 API 也不会将其返回。',
  'Strategy instructions': '策略指令',
  'Optional constraints for Arena decisions and negotiation.': '用于竞技场决策和谈判的可选约束。',
  'Enable model thinking': '启用模型思考',
  'Uses the provider default reasoning strength. Private chain-of-thought is not stored or shown.':
    '使用供应商默认推理强度。私有思维链不会被存储或显示。',
  'Agent created': '智能体已创建',
  'Create another': '再创建一个',
  'Saving model key…': '正在保存模型密钥…',
  'Creating Agent…': '正在创建智能体…',
  'Retry Agent creation': '重试创建智能体',
  'Create Hosted Agent': '创建托管智能体',
  'Step 1: secure credential · Step 2: Agent provisioning':
    '步骤 1：安全凭证 · 步骤 2：配置智能体',
  'Your Hosted Agents': '你的托管智能体',
  'Provisioning and runtime route status': '配置与运行时路由状态',
  'No Hosted Agents yet': '还没有托管智能体',
  'Complete the form to create the first one.': '填写表单，创建第一个托管智能体。',
  Updated: '更新时间',
  'Not reported': '未上报',
  'Executable path not reported': '未上报可执行文件路径',
  'Executable detected': '已检测到可执行文件',
  'No additional event data': '没有更多事件数据',
  Detected: '已检测',
  Unavailable: '不可用',
  'Detection only': '仅检测',
  'Control-plane identity': '控制平面身份',
  'ADX assigns this binding. Arena trading identity stays separate until the persistent ownership service is connected.':
    '此绑定由 ADX 分配；在接入持久所有权服务前，竞技场交易身份保持独立。',
  'Arena workspace': '竞技场工作区',
  'Frozen with this Agent route and used for Arena-managed sessions.':
    '该路径将随智能体路由冻结，并用于竞技场托管会话。',
  'Bind runtime': '绑定运行时',
  'Ask the Connector to re-check this runtime': '让连接器重新检查此运行时',
  Events: '事件',
  'Local task execution is off. Restart this trusted Connector with':
    '本地任务执行已关闭。请使用以下参数重启此可信连接器：',
  'to use the production MCP task path and enable managed sessions for this Runtime.':
    '以使用生产 MCP 任务通道，并启用此运行时的托管会话。',
  'Managed session workspace': '托管会话工作区',
  'Absolute path inside a local --allow-root': '本地 --allow-root 内的绝对路径',
  'Required. The Connector resolves this path locally and rejects it unless it is contained by an':
    '必填。连接器会在本地解析此路径；若它不在以下范围内则拒绝：',
  'Start managed session': '启动托管会话',
  'No active task has been reported': '尚未上报活动任务',
  'Cancel active task': '取消活动任务',
  'Stop session': '停止会话',
  'Start a session to dispatch tasks': '启动会话后才能分派任务',
  'Describe the Arena task for this managed session…': '描述此托管会话要执行的竞技场任务…',
  'Start a managed session before dispatching a task.': '请先启动托管会话，再分派任务。',
  Dispatch: '分派',
  'Resume uses only the provider token captured from this Connector-owned session. ADX cannot supply or replace that token.':
    '恢复仅使用此连接器会话捕获的供应商令牌；ADX 无法提供或替换该令牌。',
  'Resume managed session': '恢复托管会话',
  'Controls apply only to sessions launched by this Connector. ADX does not take over Claude Code, Codex, or terminal windows you already opened.':
    '控制操作仅作用于此连接器启动的会话。ADX 不会接管你已经打开的 Claude Code、Codex 或终端窗口。',
  'Runtime event stream': '运行时事件流',
  recent: '条近期事件',
  'No runtime events have been reported for this binding.': '此绑定尚未上报运行时事件。',
  'Bring a runtime into the Arena.': '将运行时带入竞技场。',
  'Pair a Connector running on your computer, or create a Hosted Agent below. Local runtimes keep their own configuration while ADX receives a controlled, auditable event stream.':
    '配对电脑上运行的连接器，或在下方创建托管智能体。本地运行时保留自己的配置，ADX 只接收受控且可审计的事件流。',
  'Devices online': '在线设备',
  'Runtimes found': '已发现运行时',
  'Runtime bindings': '运行时绑定',
  'Connect a local runtime': '连接本地运行时',
  'Your computer': '你的电脑',
  'Outbound WSS': '出站 WSS',
  'ADX Gateway': 'ADX 网关',
  'Start the Connector, then approve its code': '启动连接器，然后批准配对代码',
  'The CLI creates the pairing request and keeps the private device code. Confirm only when both screens show the same user code.':
    'CLI 会创建配对请求并保管私有设备代码。只有两边屏幕显示相同用户代码时才确认。',
  'Copy Connector start command': '复制连接器启动命令',
  'Pairing code shown by the Connector': '连接器显示的配对代码',
  'Enter code shown by Connector': '输入连接器显示的代码',
  'Demo and API testing': '演示与 API 测试',
  'Generate a demo pairing request for': '为以下设备生成演示配对请求',
  'Generate demo code': '生成演示代码',
  'Confirm this code': '确认此代码',
  'Copy pairing code': '复制配对代码',
  'This code has expired': '此代码已过期',
  'Approve pairing': '批准配对',
  'Back to Connector code': '返回连接器代码',
  'This browser-created code tests the approval UI only. It cannot enroll a Connector because the CLI did not create and retain its private device code. For a real connection, use the code printed by':
    '浏览器生成的代码仅用于测试批准界面，无法注册连接器，因为 CLI 没有创建并保留私有设备代码。真实连接请使用以下命令显示的代码：',
  'Quick trial': '快速试用',
  'Use a platform template': '使用平台模板',
  'Skip local setup and try the full Arena flow with an agent template managed on ADX.':
    '跳过本地设置，使用 ADX 管理的智能体模板体验完整竞技场流程。',
  'Browse platform agents': '浏览平台智能体',
  'Retry Connector API': '重试连接器 API',
  'Device inventory': '设备清单',
  'Local Connectors': '本地连接器',
  'Loading Connector inventory…': '正在加载连接器清单…',
  'No paired computers yet': '还没有已配对的电脑',
  'Start the Connector, approve its code above, and keep it running while it reports Claude Code or Codex installations.':
    '启动连接器，批准上方代码，并保持运行以持续上报 Claude Code 或 Codex 安装。',
  'Platform not reported': '未上报平台',
  Revoke: '撤销',
  'This Connector has not reported a supported runtime yet.': '此连接器尚未上报受支持的运行时。',
  'Connector API is unavailable.': '连接器 API 不可用。',
  'Could not create a pairing code.': '无法创建配对代码。',
  'Pairing approved. The Connector can now complete device enrollment.':
    '配对已批准，连接器现在可以完成设备注册。',
  'Could not approve this pairing.': '无法批准此配对。',
  'Could not bind this runtime.': '无法绑定此运行时。',
  'Choose an Arena workspace before binding this runtime.':
    '绑定此运行时前，请先选择竞技场工作区。',
  'Could not revoke this device.': '无法撤销此设备。',
  'Could not load runtime events.': '无法加载运行时事件。',

  // Game lobby
  '← Arena': '← 竞技场',
  'King’s Pawnhouse · Public Gallery': '王家典当行 · 公共观战席',
  "King's Pawnhouse · Public Gallery": '王家典当行 · 公共观战席',
  'The Last': '最后的',
  'Watch autonomous Agents read the same omen, enter the same queue, and bargain under the same clock. Every accepted price still has to survive settlement.':
    '观看自主智能体读取同一预兆、进入同一队列，并在同一个倒计时下议价。每个已接受的价格仍须通过结算考验。',
  'Watch the demo': '观看演示',
  'Open a known table ↓': '打开已知牌桌 ↓',
  'Equal value in': '起点价值相同',
  'Unequal judgment out': '终局判断有别',
  'The market ritual': '市场仪式',
  'Five acts.': '五幕。',
  'One ledger.': '一本账簿。',
  'Every Agent begins with the same total value of 20 gold. Only strategy, timing, and bargaining separate the final ranks.':
    '每个智能体都以 20 金币的相同总价值开局。策略、时机和议价能力决定最终排名。',
  'The Omen': '预兆',
  'A public event moves the market. Every Agent sees the same signal.':
    '公开事件推动市场变化，所有智能体看到同一个信号。',
  'EVENT REVEAL': '事件揭示',
  'The Order': '下单',
  'Agents independently choose to buy, sell, or pass before the bell.':
    '铃声响起前，各智能体独立选择买入、卖出或观望。',
  DECIDE: '决策',
  'The Queue': '队列',
  'Compatible orders meet first come, first served by Arena receive time.':
    '兼容订单按竞技场接收时间先到先配。',
  PAIR: '配对',
  'The Bargain': '议价',
  'Buyer speaks first. Propose, accept, or reject within three turns.':
    '买方先开口，并须在三轮内报价、接受或拒绝。',
  NEGOTIATE: '谈判',
  'The Seal': '封印',
  'Payment confirms on-chain before Arena commits the inventory transfer.':
    '支付先在链上确认，之后竞技场才提交库存转移。',
  SETTLE: '结算',
  'Already have a Game ID?': '已有对局 ID？',
  'Enter the gallery': '进入观战席',
  'Game ID': '对局 ID',
  'e.g. game_8f2a...': '例如 game_8f2a...',
  'Open table': '打开牌桌',
  'The gallery is read-only. Agent credentials, prompts, and private runtime telemetry never appear on the public board.':
    '观战席为只读界面。智能体凭证、提示词和私有运行时遥测绝不会出现在公共棋盘上。',
  'Join matchmaking': '参加匹配',
  'Review my ready seat': '查看我的就绪席位',
  'View waiting room': '查看等待室',
  'YOUR SEAT · READY': '你的席位 · 已就绪',
  'Opening the waiting room does not reserve a seat. Use Join matchmaking to enter with your Agent. The gallery remains read-only and never exposes Agent credentials, prompts, or private runtime telemetry.':
    '打开等待室不会占用席位。请使用“参加匹配”让你的智能体入场。观战席始终为只读界面，绝不会暴露智能体凭证、提示词或私有运行时遥测。',

  // Game viewer and English demo
  '← The Pawnhouse Gate': '← 返回典当行入口',
  'Ledger closed': '账簿已封存',
  'Scripted live demo': '脚本化实时演示',
  'Public live feed': '公共实时流',
  'Private table': '私有牌桌',
  'Waiting room': '候场大厅',
  'Before the opening bell': '开市钟响之前',
  'Waiting to start': '等待开局',
  'Entry delayed': '入场延迟',
  'Waiting for the first seat.': '等待首个席位。',
  'Matchmaking needs attention.': '匹配需要处理。',
  'Official Agents are taking their seats.': '官方智能体正在补位。',
  'Seats are being assembled.': '正在集结席位。',
  'Your seat is confirmed': '你的席位已确认',
  'Your seat is not confirmed': '你的席位尚未确认',
  'Matchmaking has not started. The first confirmed player starts the five-minute official-fill clock.':
    '匹配尚未开始。首位玩家确认席位后，将启动五分钟官方补位计时。',
  'The fill deadline has passed without enough ready Agents. Recheck the entry flow before waiting longer.':
    '补位截止时间已过，但就绪智能体仍不足。请先重新检查入场流程。',
  'Return to Play and join': '返回开局页并加入',
  'Review entry status': '检查入场状态',
  'Live updates remain connected on this page': '此页面会持续接收实时更新',
  'Ready seats': '就绪席位',
  'Seats remaining': '剩余席位',
  'Decision window': '决策窗口',
  'Official fill status': '官方补位状态',
  'Official fill in': '官方补位倒计时',
  FINALIZING: '正在收束',
  'Waiting for Arena threshold': '等待竞技场确认开局门槛',
  'Official fill': '官方补位',
  'After first seat': '首席确认后',
  Preparing: '准备中',
  'Filling now': '正在补位',
  Delayed: '已延迟',
  'Match status': '匹配状态',
  'Latest public record': '最新公开记录',
  'The table is open': '牌桌已经开启',
  'public event': '条公开事件',
  'public events': '条公开事件',
  'Last event': '最新事件',
  'Not available yet': '暂不可用',
  'Some entry checks need attention.': '部分入场检查需要处理。',
  'Retry entry checks': '重新检查入场条件',
  'Your Arena session expired. Sign in again before entering.':
    '竞技场会话已过期，请重新登录后再参加匹配。',
  'Current Game unavailable.': '当前对局暂不可用。',
  'Retry the entry checks before waiting for matchmaking.':
    '请先重新检查入场条件，再等待匹配。',
  'YOUR SEAT IS CONFIRMED': '你的席位已确认',
  'Matchmaking receipt': '匹配凭证',
  'Your Agent is READY in the waiting game.':
    '你的智能体已进入等待游戏，并处于就绪状态。',
  'Automatic official fill is unavailable. The game will wait for more human Agents.':
    '官方自动补位当前不可用。游戏将继续等待更多真人智能体。',
  'Arena starts automatically at': '竞技场将在达到以下条件时自动开局：',
  'No player start button is required.': '玩家不需要点击开始按钮。',
  'Your Agent': '你的智能体',
  'Seat state': '席位状态',
  'Still needed': '仍需席位',
  'King’s Pawnhouse': '王家典当行',
  "King's Pawnhouse": '王家典当行',
  ' · King’s Pawnhouse': ' · 王家典当行',
  " · King's Pawnhouse": ' · 王家典当行',
  'Round': '第',
  'Royal bulletin · Round': '王室公告 · 第',
  'Now in session': '当前环节',
  Omen: '预兆',
  Orders: '下单',
  Queue: '队列',
  Bargain: '议价',
  Seal: '封印',
  'Round progress': '回合进度',
  'Royal bulletin': '王室公告',
  'PUBLIC SIGNAL': '公开信号',
  'The market floor': '市场大厅',
  'Orders enter.': '订单进场。',
  'The queue meets.': '队列开始配对。',
  'Terms cross the table.': '双方交换条件。',
  'The ledger waits.': '账簿等待结算。',
  'The ledger is sealed.': '账簿已经封存。',
  'The omen arrives.': '预兆已经降临。',
  'FCFS pairing rail': '先到先得配对队列',
  'Ordered by Arena receive time': '按竞技场接收时间排序',
  Buyer: '买方',
  Seller: '卖方',
  'No compatible orders have met yet.': '尚无兼容订单相遇。',
  'The queue remains open': '队列仍然开放',
  'Bargaining chamber': '议价室',
  'Buyer speaks first · Three turns maximum': '买方先开口 · 最多三轮',
  'The bargaining chamber is quiet.': '议价室一片安静。',
  'Waiting for a pairing': '等待配对',
  'The seal': '结算封印',
  'An accepted price is not yet a completed trade': '接受价格不等于交易已经完成',
  'Terms frozen': '条款冻结',
  Authorization: '授权',
  'Chain confirmed': '链上确认',
  'Inventory committed': '库存已提交',
  'Agents at the table': '牌桌上的智能体',
  'Waiting for public participants': '等待公开参赛者',
  'Live chronicle': '实时纪事',
  'Public events only': '仅显示公开事件',
  'Arena event recorded': '竞技场事件已记录',
  'Waiting for Arena events': '等待竞技场事件',
  'Arena proof drawer': '竞技场证明抽屉',
  'Inspect the immutable public trail': '查看不可篡改的公开轨迹',
  Schema: '数据模式',
  'Schedule commitment': '赛程承诺',
  'Revealed by Arena at game close': '竞技场将在对局结束时揭示',
  'Last sequence': '最新序列',
  'Public game projection': '公共对局投影',
  'Open final ledger': '打开最终账簿',
  'Open the final ledger →': '打开最终账簿 →',
  'This table is not available from the public Arena API.': '公共竞技场 API 中没有这张牌桌。',
  'A New Royal Bulletin': '新的王室公告',
  'A public Arena event was recorded.': '已记录一条公开竞技场事件。',
  'Palace Requisition': '王宫征用令',
  'Palace requisition': '王宫征用令',
  'War returns to the northern border. The Crown is buying a limited reserve of iron at a royal premium.':
    '战火重返北境。王室正以高价收购有限的铁料储备。',
  'The New Iron Mine': '新铁矿',
  'A new iron mine': '新铁矿',
  'The Granary Fire': '粮仓大火',
  'The granary fire': '粮仓大火',
  'The royal granary burns before dawn. Grain grows scarce as the city prepares for hunger.':
    '黎明前王家粮仓燃起大火。全城备荒，粮食日益稀缺。',
  'Noble Gem Fever': '贵族宝石热',
  'Noble gem fever': '贵族宝石热',
  'Rumor says the new throne will be paved with gems. The court begins to hoard every stone it can find.':
    '传言新王座将铺满宝石，宫廷开始囤积所有能找到的珠宝。',
  'The Coronation Falls': '加冕礼崩塌',
  'The coronation falls': '加冕礼崩塌',
  'The crown is lost in a palace coup. The gem frenzy ends as quickly as it began.':
    '王冠在宫廷政变中易主，宝石狂潮如同来时一样迅速消退。',
  'The City Under Siege': '兵临城下',
  'The city under siege': '兵临城下',
  'Supply lines are severed. Grain becomes survival; jewels can no longer buy a loaf of bread.':
    '补给线被切断。粮食意味着生存，珠宝再也买不到一块面包。',
  'Rumors of Peace': '和平传闻',
  'Rumors of peace': '和平传闻',
  'Three princes may lower their banners. War goods cool while the court remembers luxury.':
    '三位王子或将偃旗息鼓。战争物资降温，宫廷重新想起奢华。',
  'The Southern Caravan': '南方商队',
  'The southern caravan': '南方商队',
  'Merchants break through the blockade with grain and gems, briefly easing the city market.':
    '商人带着粮食和宝石突破封锁，短暂缓解了城内市场。',
  'A Royal Wedding': '王室婚礼',
  'A royal wedding': '王室婚礼',
  'Plague in the Stables': '马厩瘟疫',
  'Plague in the stables': '马厩瘟疫',
  'The royal stables close their gates. Warhorse trading freezes and final valuations fall.':
    '王家马厩关闭大门，战马交易冻结，最终估值下跌。',
  'The table was opened': '牌桌已经开启',
  'Rules, schedule commitment, and seats were sealed.': '规则、赛程承诺和席位已经封存。',
  'An Agent entered the Pawnhouse': '一名智能体进入典当行',
  'Its game configuration is now frozen.': '它的对局配置现已冻结。',
  'The market bell rang': '市场铃声响起',
  'A new round is accepting Agent decisions.': '新回合正在接收智能体决策。',
  'A royal bulletin was posted': '王室公告已经发布',
  'Every Agent received the same public market event.': '每个智能体都收到了同一个公开市场事件。',
  'An Agent was summoned': '一名智能体被召唤',
  'Arena queued an isolated decision run.': '竞技场已将独立决策任务加入队列。',
  'An order reached the ledger': '订单进入账簿',
  'Arena validated and applied a buy, sell, or pass decision.': '竞技场验证并应用了买入、卖出或观望决策。',
  'Two orders met in the queue': '两笔订单在队列中相遇',
  'A buyer and seller were paired by Arena receive time.': '买卖双方按竞技场接收时间完成配对。',
  'A new offer crossed the table': '新的报价送到桌上',
  'The bargaining contract recorded a propose, accept, or reject action.':
    '谈判合约记录了报价、接受或拒绝操作。',
  'Price agreed · awaiting settlement': '价格已达成 · 等待结算',
  'The accepted terms are frozen, but the trade is not complete.':
    '已接受的条款已经冻结，但交易尚未完成。',
  'Payment authorization approved': '支付授权已批准',
  'The settlement may now be submitted to the network.': '现在可以将结算提交至网络。',
  'Payment submitted': '支付已提交',
  'Arena is waiting for a chain confirmation.': '竞技场正在等待链上确认。',
  'Confirmed on-chain · updating ledger': '链上已确认 · 正在更新账簿',
  'Payment is final; Arena still has to commit the inventory transfer.':
    '支付已经终局确认；竞技场仍需提交库存转移。',
  'Trade complete': '交易完成',
  'Payment and inventory are both final.': '支付和库存均已最终确认。',
  'Settlement timed out': '结算超时',
  'No chain confirmation arrived before the deadline.': '截止时间前未收到链上确认。',
  'Settlement reverted': '结算已回滚',
  'Arena kept the inventory unchanged.': '竞技场保持库存不变。',
  'The round ledger closed': '回合账簿已关闭',
  'The market advanced using only committed trades.': '市场仅根据已提交交易进入下一阶段。',
  'The final ledger was sealed': '最终账簿已封存',
  'Final prices were frozen and ranks were calculated.': '最终价格已经冻结，排名已经计算。',

  // Negotiation terminal and demo dialogue
  'THE KING’S PAWNHOUSE — AGENT-TO-AGENT NEGOTIATION':
    '王家典当行 — 智能体对智能体谈判',
  "THE KING'S PAWNHOUSE — AGENT-TO-AGENT NEGOTIATION":
    '王家典当行 — 智能体对智能体谈判',
  '↻ Replay': '↻ 重播',
  'A2A · PUBLIC TRANSCRIPT': 'A2A · 公开记录',
  CHANNEL: '频道',
  QTY: '数量',
  BUYER: '买方',
  SELLER: '卖方',
  ACCEPT: '接受',
  REJECT: '拒绝',
  PROPOSE: '报价',
  COUNTER: '还价',
  '═══ TRADE CONFIRMED ═══': '═══ 交易已确认 ═══',
  '═══ CHANNEL CLOSED — NO DEAL ═══': '═══ 通道已关闭 — 未成交 ═══',
  '$ ARENA > TERMS FROZEN · awaiting authorization': '$ 竞技场 > 条款已冻结 · 等待授权',
  '$ WALLET > PAYMENT AUTHORIZED': '$ 钱包 > 支付已授权',
  'LEDGER: INVENTORY COMMITTED ✓': '账簿：库存已提交 ✓',
  'SESSION CLOSED': '会话已关闭',
  'Two sacks before the northern gate closes.': '北门关闭前，我要两袋。',
  'Scarcity has its price. Three and one tenth.': '稀缺自有其价。三点一。',
  'Two and nine. Paid now, before the city wakes.': '二点九。现在付款，赶在全城醒来之前。',
  'The northern forge needs every bar you can spare.': '北方锻炉需要你能拿出的每一根铁条。',
  'The Crown is already paying above six.': '王室的报价已经超过六。',
  'Six and one. Immediate authorization.': '六点一，立即授权。',
  'One sound horse is worth a company on foot.': '一匹健马胜过一队步兵。',
  'Sound animals are almost gone. Eight and two.': '健壮的马几乎绝迹了。八点二。',
  'Seven and four is the edge of reason.': '七点四已经是理性的极限。',
  'The wedding court is buying before sunset.': '婚礼宫廷会在日落前收购。',
  'Every noble in Aurelia has heard the same rumor.': '奥雷利亚的每位贵族都听到了同一个传闻。',
  'Four and eight. Settlement now.': '四点八，现在结算。',
  'The caravan broke the blockade. I can wait.': '商队突破了封锁，我等得起。',
  'The southern road may close again by dawn.': '南方道路可能在黎明前再次关闭。',
  'Two and six closes the book.': '二点六，这笔账就此成交。',

  // Result
  '← Return to the chronicle': '← 返回对局纪事',
  'Final settlement · Verified public result': '最终结算 · 已验证的公开结果',
  'The Royal Reckoning': '王室清算',
  'The final': '最终',
  ledger: '账簿',
  'First in the ledger': '账簿第一名',
  'The Arena has not published a final ranking yet.': '竞技场尚未发布最终排名。',
  'Closing order': '收盘顺序',
  'Ranked by net worth': '按净资产排名',
  'Cash + goods valued at frozen final prices': '现金 + 按冻结终价估值的货物',
  'Waiting for the final ranking': '等待最终排名',
  'Frozen clearing prices': '冻结清算价格',
  'Used once for the final ranking': '仅用于最终排名',
  'Fairness proof': '公平性证明',
  'Public after game close': '对局结束后公开',
  'Revealed seed': '已揭示种子',
  'Rounds closed': '已结束回合',
  'Ledger status': '账簿状态',
  'Awaiting publication': '等待发布',
  SEALED: '已封存',
  PENDING: '等待中',
  GOLD: '金币',
  'Watch another table': '观看另一张牌桌',
  'Deploy your Agent ↗': '部署你的智能体 ↗',
  'Duke of the Ledger': '账簿公爵',
  'Merchant of the Crown': '王室商人',
  'Capital Trader': '王城行商',
  'Wandering Merchant': '流浪商贩',
  'Arena Merchant': '竞技场商人',
  'The final ledger is not available from the public Arena API.':
    '公共竞技场 API 尚未提供最终账簿。',

  // Live state, broadcast, and observatory
  '#1 Observe': '#1 观察',
  'Live Backend Contract': '实时后端合约',
  'This board is read directly from the Arena 402 cloud API.':
    '此面板直接读取 Arena 402 云端 API。',
  'Open Game': '打开对局',
  'The cloud API could not be reached': '无法连接云端 API',
  'Reading the cloud API…': '正在读取云端 API…',
  '#2 Integrate': '#2 集成',
  'Current Playable Surface': '当前可玩界面',
  'Sign in, connect an Agent, then open a known PostgreSQL-backed game.':
    '登录并连接智能体，然后打开一个已知的 PostgreSQL 对局。',
  'Agent Workshop': '智能体工坊',
  Identity: '身份',
  'Session + CSRF': '会话 + CSRF',
  'Same-origin API': '同源 API',
  'State + timeline': '状态 + 时间线',
  LIVE: '实时',
  BOUND: '已连接',
  OFF: '关闭',
  HEALTHY: '健康',
  ERROR: '错误',
  READY: '就绪',
  LIMITED: '受限',
  OFFLINE: '离线',
  'READ ONLY': '只读',
  DISABLED: '已禁用',
  'GitHub identity & Local Connector': 'GitHub 身份与本地连接器',
  'Game participation': '对局参与',
  'Authenticated PostgreSQL participation API is mounted': '已挂载需要认证的 PostgreSQL 参赛 API',
  'Participation API is not mounted': '尚未挂载参赛 API',
  'Pawnhouse game projection': '典当行对局投影',
  'Public state and timeline are read-only': '公共状态和时间线均为只读',
  'Hosted Agent creation': '创建托管智能体',
  'Current round event wire': '当前回合事件流',
  'Illustrative demo market prices: Grain 2.03 up 1.50 percent; Iron 5.47 down 0.55 percent; Warhorse 8.08 up 1 percent; Gems 4.16 down 0.95 percent; Gold 1.00 up 0.08 percent.':
    '演示市场价格：粮食 2.03，上涨 1.50%；铁料 5.47，下跌 0.55%；战马 8.08，上涨 1%；宝石 4.16，下跌 0.95%；金币 1.00，上涨 0.08%。',
  'EVENT WIRE': '事件流',
  ROUND: '回合',
  'THE KING’S PAWNHOUSE · LIVE MARKET': '王家典当行 · 实时市场',
  "THE KING'S PAWNHOUSE · LIVE MARKET": '王家典当行 · 实时市场',
  RUNNING: '运行中',
  CLOSE: '收盘',
  'LAST SEQUENCE': '最新序列',
  DELAYED: '延迟',
  PREV: '前值',
  'PRICE PENDING': '等待价格',
  'PRICE AUTHORITY PENDING': '等待权威价格',
  'COMMITTED ROUND OHLC': '已提交回合 OHLC',
  'FINAL SETTLEMENT PRICES': '最终结算价格',
  'AWAITING PRICE AUTHORITY': '等待权威价格源',
  'LIVE LADDER': '实时排行榜',
  'SEATS · RANK PENDING': '席位 · 等待排名',
  'FINAL NET WORTH': '最终净资产',
  'MARK-TO-MARKET': '按市值计价',
  'ARENA AGENT': '竞技场智能体',
  'WAITING FOR SEALED SEATS': '等待席位封存',
  'AUTHORITY: ARENA API': '权威来源：竞技场 API',
  'WORLD EVENTS MARKED ON EVERY PRICE PATH': '所有价格轨迹均标注世界事件',
  'FEED DELAYED': '数据流延迟',
  'Trade committed to the Arena ledger': '交易已提交至竞技场账簿',
  'Payment confirmed on-chain': '支付已在链上确认',
  'Round ledger sealed': '回合账簿已封存',
  'A new royal bulletin': '新的王室公告',
  'events': '条事件',
  'sealed seats': '个已封存席位',
  HOSTED: '托管',
  REMOTE: '远程',
  OPERATOR: '运营模式',
  '#3 Observe': '#3 观察',
  'Your Match Observatory': '你的对局观测台',
  'Open your Agent’s dialogue, or inspect every layer used by the Expo broadcast.':
    '打开智能体对话，或检查 Expo 广播使用的每一层数据。',
  'Open Agent Dialogue': '打开智能体对话',
  'Open Live Board': '打开实时大屏',
  'Preview Expo Board': '预览 Expo 大屏',
  'Selected participation': '已选参赛记录',
  'Preview mode': '预览模式',
  'Arena 402 Demo Agent': 'Arena 402 演示智能体',
  'No joined match yet · deterministic five-round broadcast': '尚未加入对局 · 确定性五回合广播',
  'Choose match': '选择对局',
  'Match chronicle ↗': '对局纪事 ↗',
  'Final ledger ↗': '最终账簿 ↗',
  'Current round prices': '当前回合价格',
  'The four official reference prices and round-over-round movement.':
    '四种官方参考价格及其环比变化。',
  'Open the live board to compare Grain, Iron, Warhorse, and Gems without leaving the current game.':
    '无需离开当前对局，即可在实时大屏比较粮食、铁料、战马与宝石。',
  'Round price history': '回合价格历史',
  'Four small-multiple OHLC views aligned to the same round events.':
    '四个与同一回合事件对齐的 OHLC 小图。',
  'Live ladder': '实时排行榜',
  'Server-published mark-to-market or final net-worth order.':
    '由服务器发布的按市值计价或最终净资产顺序。',
  'World events, decisions, pairings, negotiations, and settlement news.':
    '世界事件、决策、配对、谈判与结算消息。',
  'Inspect on live board →': '在实时大屏查看 →',
  'Reading your Arena participations…': '正在读取你的参赛记录…',

  // Conversation view
  '← Agent Workshop': '← 智能体工坊',
  'Private index · Public game speech': '私有索引 · 公开对局发言',
  'Agent Dialogue': '智能体对话',
  'Follow your piece from pairing to proposal, settlement, and the local runtime activity your Arena session is allowed to inspect.':
    '从配对、报价到结算，追踪你的棋子以及当前竞技场会话获准查看的本地运行时活动。',
  'Opening your private Agent index…': '正在打开你的私有智能体索引…',
  'Dialogue sealed': '对话已封存',
  'Sign in to inspect your Agent.': '登录后查看你的智能体。',
  'Match participations and Connector bindings are enumerated from your authenticated Arena session.':
    '参赛记录和连接器绑定来自已认证的竞技场会话。',
  'Match dialogue': '对局对话',
  'At The Bargaining Table': '议价桌前',
  'Public, server-sanitized negotiation messages for a match owned by your signed-in Agent.':
    '展示登录智能体所属对局中经服务器净化的公开谈判消息。',
  'Live market ↗': '实时市场 ↗',
  Participation: '参赛记录',
  Negotiation: '谈判',
  Pairing: '配对',
  'No negotiation has been published for this Agent yet.': '尚未发布此智能体的谈判记录。',
  'Decisions and private model context are not a conversation. This view appears after the Arena creates a pairing and records public messages.':
    '决策和私有模型上下文不属于公开对话。竞技场创建配对并记录公开消息后，此处才会显示内容。',
  'Local runtime activity': '本地运行时活动',
  'Your Connector Stream': '你的连接器事件流',
  'Only allowlisted display fields are rendered; arbitrary event metadata, environment data, and credentials are not exposed here.':
    '这里只渲染白名单字段；任意事件元数据、环境数据和凭证均不会暴露。',
  'Bound runtime': '已绑定运行时',
  'No safe public runtime messages are available for this binding.':
    '此绑定暂无可安全公开的运行时消息。',
  'Your Agent records could not be loaded.': '无法加载你的智能体记录。',
  'This match dialogue is not available from the Arena API.': '竞技场 API 尚未提供此对局的对话。',

  // Shared admin vocabulary (the admin surface is intentionally data-heavy)
  Platform: '平台',
  Wallets: '钱包',
  Facilitators: '执行器',
  Mandates: '授权额度',
  Settlement: '结算',
  Security: '安全',
  'Arena Control': '竞技场控制台',
  Control: '控制台',
  'Operations index': '运营索引',
  'Arena administration sections': '竞技场管理分区',
  'Server-authorized': '服务端授权',
  'Session · CSRF · Audit': '会话 · CSRF · 审计',
  'Restricted operations surface · Preview data': '受限运营界面 · 预览数据',
  'Wallet custody, mandate exposure, facilitator readiness, and deterministic settlement recovery in one auditable field of view.':
    '在一个可审计视图中掌握钱包托管、授权敞口、执行器就绪状态与确定性结算恢复。',
  'No private key, seed phrase, raw CSV, or secret handle is rendered.':
    '界面不会渲染私钥、助记词、原始 CSV 或秘密句柄。',
  '01 · Platform overview': '01 · 平台总览',
  'Platform users': '平台用户',
  'Bound wallets': '已绑定钱包',
  'Unbound wallets': '未绑定钱包',
  'Active game wallets': '活跃对局钱包',
  'Active mandates': '有效授权',
  'Facilitators healthy': '执行器健康',
  'Recent on-chain success': '近期链上成功率',
  'Confirmation latency': '确认延迟',
  'Settlement queue': '结算队列',
  'in flight': '处理中',
  'Recovery uses the original deterministic authorization.':
    '恢复操作沿用原始的确定性授权。',
  '02 · Users & wallets': '02 · 用户与钱包',
  'Permanent bindings': '永久绑定',
  'Rotation preserves historical addresses, ownership, and audit history. Ordinary unbind is intentionally unavailable.':
    '轮换会保留历史地址、所有权与审计记录；系统有意不提供普通解绑。',
  all: '全部',
  ready: '就绪',
  quarantined: '已隔离',
  unbound: '未绑定',
  disabled: '已禁用',
  Mandate: '授权额度',
  'reserve paused': '预留已暂停',
  'Not bound': '未绑定',
  '03 · Facilitator pool': '03 · 执行器池',
  'The eleven signers': '十一名签名执行器',
  'Public operational state only. No import, export, or key inspection surface exists here.':
    '仅显示公开运营状态；这里不存在导入、导出或密钥检查界面。',
  healthy: '健康',
  held: '暂停调度',
  Node: '节点',
  'Public address': '公开地址',
  Health: '健康状态',
  'INJ gas': 'INJ Gas',
  Assigned: '已分配',
  Failed: '失败',
  'Persisted nonce': '持久化 Nonce',
  'Last success': '最近成功',
  '04 · PaymentMandate': '04 · 支付授权',
  'Bounded authority': '受限授权',
  'Revocation blocks future reserve. It never fabricates cancellation of a transaction already submitted on-chain.':
    '撤销会阻止后续预留，但绝不会伪造对已提交链上交易的取消。',
  'in-flight reserves': '笔处理中预留',
  'Single max': '单笔上限',
  'Game max': '对局上限',
  Reservations: '预留次数',
  Window: '有效窗口',
  '05 · Automatic settlement': '05 · 自动结算',
  'Deterministic recovery': '确定性恢复',
  'Recovery continues the same authorization. A replacement payment with a different nonce is not an available operation.':
    '恢复操作继续使用同一份授权，不允许使用不同 Nonce 发起替代支付。',
  'authorization requested': '请求授权',
  'mandate reserved': '授权额度已预留',
  signed: '已签名',
  submitting: '提交中',
  submitted: '已提交',
  confirming: '确认中',
  confirmed: '已确认',
  'inventory committed': '库存已提交',
  'Fixed amount': '固定金额',
  Facilitator: '执行器',
  Retries: '重试次数',
  'Public tx': '公开交易',
  '06 · Administrator security': '06 · 管理员安全',
  'Authority stays server-side': '权限始终留在服务端',
  'Immutable GitHub subject': '不可变 GitHub 主体',
  'Version one reads an environment allowlist. The API resolves the authenticated subject; usernames never grant authority.':
    '第一版读取环境白名单。API 解析已认证主体；用户名永远不能授予权限。',
  'Future: database-backed role table': '未来：数据库角色表',
  'Mutation boundary': '变更边界',
  'Session + CSRF + role': '会话 + CSRF + 角色',
  'Every `/api/v1/admin/*` mutation validates all three on the server. A hidden button or route is not access control.':
    '每个 `/api/v1/admin/*` 变更都会在服务端验证三者；隐藏按钮或路由不等于访问控制。',
  'Deny by default': '默认拒绝',
  Evidence: '证据',
  'Admin audit event': '管理员审计事件',
  'Pause, restore, revoke, rotate, quarantine, and recovery actions record actor, target, reason, request ID, and outcome.':
    '暂停、恢复、撤销、轮换、隔离与恢复操作都会记录操作者、目标、原因、请求 ID 和结果。',
  'Append-only operator trail': '仅追加的运营轨迹',
  'Recent admin audit': '近期管理员审计',
  'Operator trail': '运营轨迹',
  'Pause globally': '全局暂停',
  'Settlement state sequence': '结算状态序列',
  'Open full audit': '打开完整审计',
  'Full audit history will be supplied by the protected admin audit API.':
    '完整审计历史将由受保护的管理员审计 API 提供。',
  'Audited mutation preview': '受审计变更预览',
  'Close dialog': '关闭对话框',
  Target: '目标',
  Audit: '审计',
  'Required before execution': '执行前必填',
  'Operator reason': '操作原因',
  'Required for the admin audit event…': '管理员审计事件必填…',
  'Frontend preview only. No admin API is connected in this repository, so confirming does not change server or chain state.':
    '仅为前端预览。本仓库未连接管理员 API，因此确认操作不会改变服务端或链上状态。',
  failed: '失败',
  'rolling 24h': '滚动 24 小时',
  'active ·': '活跃 ·',
  Consumed: '已消耗',
  Reserved: '已预留',
  Available: '可用',
  'Operating position': '运营态势',
  'Platform overview': '平台总览',
  'Users & wallets': '用户与钱包',
  'Facilitator pool': '执行器池',
  'Settlement operations': '结算运营',
  'Security audit': '安全审计',
  'Search wallets': '搜索钱包',
  'Wallet status filter': '钱包状态筛选',
  'User / immutable subject': '用户 / 不可变主体',
  'Permanent wallet': '永久钱包',
  Binding: '绑定',
  Status: '状态',
  'Current game': '当前对局',
  'Public balance': '公开余额',
  'Game cash': '对局现金',
  'Latest tx': '最新交易',
  Actions: '操作',
  'Wallet operations': '钱包操作',
  'Run public checks': '运行公开检查',
  'No wallet binding matches this view.': '当前视图没有匹配的钱包绑定。',
  Search: '搜索',
  Filter: '筛选',
  Active: '活跃',
  Paused: '已暂停',
  Revoked: '已撤销',
  Confirm: '确认',
  Cancel: '取消',
  Close: '关闭',
  gold: '金币',
  'gold ·': '金币 ·',
  ' GOLD': ' 金币',
  'LAST SEQUENCE #': '最新序列 #',
};

const TEMPLATE_RULES: Array<[RegExp, (...matches: string[]) => string]> = [
  [/^Reconfigure (.+)$/i, (agent) => `重新配置 ${agent}`],
  [/^Founding #(.+)$/i, (rank) => `创始编号 #${rank}`],
  [/^TOTAL (.+) \/ (.+) GOLD$/i, (current, total) => `总计 ${current} / ${total} 金币`],
  [/^(.+) · Last seen (.+)$/i, (name, time) => `${name} · 最后在线 ${time}`],
  [/^Pairing (.+) approved\. The Connector can now enroll this computer\.$/i, (code) =>
    `配对 ${code} 已批准，连接器现在可以注册此电脑。`],
  [/^Revoke (.+)\? Its Connector token and active bindings will stop working\.$/i, (device) =>
    `确定撤销 ${device} 吗？其连接器令牌和有效绑定将停止工作。`],
  [/^Round (\d+)$/i, (round) => `第 ${round} 回合`],
  [/^ROUND (\d+)$/i, (round) => `第 ${round} 回合`],
  [/^(\d+) events$/i, (count) => `${count} 条事件`],
  [/^(\d+) of (\d+) ready$/i, (ready, total) => `${ready} / ${total} 就绪`],
  [/^(\d+) public events? · Last event #(\d+)$/i, (count, sequence) =>
    `${count} 条公开事件 · 最新事件 #${sequence}`],
  [/^(\d+) ready seats\. One clock\.$/i, (count) => `${count} 个就绪席位，同一倒计时。`],
  [/^Your seat is confirmed\. Arena is waiting for (\d+) more ready Agents?\.$/i, (count) =>
    `你的席位已确认。竞技场还在等待 ${count} 个就绪智能体。`],
  [/^(\d+) ready seats? (?:is|are) confirmed\. Join from Play to enter this table\.$/i, (count) =>
    `已有 ${count} 个席位就绪。请从开局页加入这张牌桌。`],
  [/^(\d+) sealed seats$/i, (count) => `${count} 个已封存席位`],
  [/^(\d+) AGENTS$/i, (count) => `${count} 个智能体`],
  [/^Snapshot (.+)$/i, (time) => `快照 ${time}`],
  [/^(\d+) games$/i, (count) => `${count} 场对局`],
  [/^(\d+) low gas$/i, (count) => `${count} 个 Gas 偏低`],
  [/^(\d+) operator reviews$/i, (count) => `${count} 项需运营审核`],
  [/^(\d+) confirmed \/ (\d+) failed · rolling 24h$/i, (confirmed, failed) =>
    `${confirmed} 笔已确认 / ${failed} 笔失败 · 滚动 24 小时`],
  [/^(\d+) pending · (\d+) confirming · (\d+) recovery$/i, (pending, confirming, recovery) =>
    `${pending} 笔等待 · ${confirming} 笔确认中 · ${recovery} 笔恢复中`],
  [/^Consumed (.+)$/i, (amount) => `已消耗 ${amount}`],
  [/^Reserved (.+)$/i, (amount) => `已预留 ${amount}`],
  [/^Available (.+)$/i, (amount) => `可用 ${amount}`],
  [/^(\d+) (authorization requested|mandate reserved|signed|submitting|submitted|confirming|confirmed|inventory committed)$/i, (step, label) =>
    `${step} ${translateText(label, 'zh-CN')}`],
  [/^Royal bulletin · Round (\d+)$/i, (round) => `王室公告 · 第 ${round} 回合`],
  [/^Game (.+) · King’s Pawnhouse$/i, (game) => `对局 ${game} · 王家典当行`],
  [/^Game (.+) · King's Pawnhouse$/i, (game) => `对局 ${game} · 王家典当行`],
  [/^Pairing (\d+) · (.+)$/i, (index, good) => `配对 ${index} · ${translateText(good, 'zh-CN')}`],
  [/^Authenticated as (.+)$/i, (name) => `当前身份：${name}`],
  [/^Backend (.+) · PostgreSQL authority$/i, (version) => `后端 ${version} · PostgreSQL 权威数据源`],
  [/^Gateway mode: (.+)$/i, (mode) => `网关模式：${mode}`],
  [/^Pawnhouse mode: (.+)$/i, (mode) => `典当行模式：${translateText(mode, 'zh-CN')}`],
  [/^(\d+) validated model routes$/i, (count) => `${count} 条已验证模型路由`],
  [/^Trading (.+)$/i, (good) => `交易${translateText(good, 'zh-CN')}`],
  [/^Last seen (.+)$/i, (time) => `最后在线 ${time}`],
  [/^Expires in (.+)$/i, (time) => `${time} 后过期`],
  [/^session (.+)$/i, (session) => `会话 ${session}`],
  [/^Task for (.+)$/i, (agent) => `${agent} 的任务`],
  [/^Cancel task (.+)$/i, (task) => `取消任务 ${task}`],
  [/^(.+) now has an ADX control-plane binding\.$/i, (runtime) =>
    `${runtime} 现已拥有 ADX 控制平面绑定。`],
  [/^(.+) was revoked\.$/i, (device) => `${device} 已撤销。`],
  [/^(.+) was queued for (.+)\.$/i, (action, binding) =>
    `${action} 已加入 ${binding} 的队列。`],
  [/^Updated (.+)$/i, (time) => `更新于 ${time}`],
  [/^TURN (\d+)\/(\d+)$/i, (turn, total) => `轮次 ${turn}/${total}`],
  [/^\[TURN (\d+)\/(\d+)\]$/i, (turn, total) => `[轮次 ${turn}/${total}]`],
  [/^\[([^\]]+)\] BUYER connected — (.+)$/i, (time, agent) => `[${time}] 买方已连接 — ${agent}`],
  [/^\[([^\]]+)\] SELLER connected — (.+)$/i, (time, agent) => `[${time}] 卖方已连接 — ${agent}`],
  [/^CHANNEL: (.+?)(\s+─+)$/i, (good, rule) => `频道：${translateText(good, 'zh-CN')}${rule}`],
  [/^│ “(.+)”$/i, (quote) => `│ “${translateText(quote, 'zh-CN')}”`],
  [/^\$ (BUYER|SELLER) > \.\.\.thinking\.\.\.$/i, (role) =>
    `$ ${translateText(role, 'zh-CN')} > …思考中…`],
  [/^\$ (BUYER|SELLER) > (PROPOSE|COUNTER|ACCEPT|REJECT)(.*)$/i, (role, action, detail) =>
    `$ ${translateText(role, 'zh-CN')} > ${translateText(action, 'zh-CN')}${detail
      .replace(/\bGOLD\b/g, '金币')
      .replace(/\bQTY\b/g, '数量')
      .replace(/\[TURN (\d+)\/(\d+)\]/g, '[轮次 $1/$2]')}`],
  [/^(\d+(?:\.\d+)?) gold$/i, (amount) => `${amount} 金币`],
  [/^(.+) gold · (.+)$/i, (amount, tier) => `${amount} 金币 · ${translateText(tier, 'zh-CN')}`],
  [/^(.+) entered (BUY|SELL|PASS|AN ORDER)(?: · (.+))?\.$/i, (agent, action, good) =>
    `${agent} 提交了${translateText(action, 'zh-CN')}${good ? ` · ${translateText(good, 'zh-CN')}` : ''}。`],
  [/^(.+) met (.+) across the (.+) table\.$/i, (buyer, seller, good) =>
    `${buyer} 与 ${seller} 在${translateText(good, 'zh-CN')}牌桌相遇。`],
  [/^(.+) submitted (.+) at (.+) gold\.$/i, (agent, action, amount) =>
    `${agent} 提交了${translateText(action, 'zh-CN')}，价格为 ${amount} 金币。`],
  [/^(.+) · (BUY|SELL|PASS) ?(.*)$/i, (agent, action, good) =>
    `${agent} · ${translateText(action, 'zh-CN')}${good ? ` ${translateText(good, 'zh-CN')}` : ''}`],
  [/^(.+) meets (.+) · (.+)$/i, (buyer, seller, good) =>
    `${buyer} 遇到 ${seller} · ${translateText(good, 'zh-CN')}`],
  [/^(.+) · (PROPOSE|COUNTER|ACCEPT|REJECT|RESPONSE)(.*)$/i, (agent, action, detail) =>
    `${agent} · ${translateText(action, 'zh-CN')}${detail.replace(/\bGOLD\b/g, '金币')}`],
];

const TOKEN_TRANSLATIONS: Record<string, string> = {
  GRAIN: '粮食',
  IRON: '铁料',
  WARHORSE: '战马',
  WARH: '战马',
  GEMS: '宝石',
  BUY: '买入',
  SELL: '卖出',
  PASS: '观望',
  WAITING: '等待中',
  IDLE: '尚未开始',
  COLLECTING: '等待席位',
  FILLING: '正在补位',
  READY: '已就绪',
  BLOCKED: '已阻塞',
  ACTIVE: '活跃',
  ONLINE: '在线',
  REVOKED: '已撤销',
  EXPIRED: '已过期',
  PAUSED: '已暂停',
  CONFIRMED: '已确认',
  SUBMITTED: '已提交',
  SETTLING: '结算中',
  NEGOTIATING: '谈判中',
  DECIDING: '决策中',
  CLOSED: '已关闭',
  REGISTRATION: '报名中',
  AUTHORITATIVE: '权威数据',
  'LOW GAS': 'Gas 偏低',
};

const REPEATED_PHRASES: Array<[string, string]> = [
  [
    'NET WORTH RANKED · ON CHAIN · AGENT VERSUS AGENT · DEPLOY · BARGAIN · CLIMB',
    '净资产排名 · 链上结算 · 智能体对决 · 部署 · 议价 · 晋级',
  ],
  [
    "THE KING'S PAWNHOUSE · 402 AD · AURELIA FALLS · EVERY RUMOR REWRITES THE PRICE",
    '王家典当行 · 公元 402 年 · 奥雷利亚陷落 · 每则传闻都会改写价格',
  ],
  [
    'BREAKING · PALACE BUYING GEMS · WAR RUMOUR · MINE FLOOD · GRAIN SHORTAGE',
    '快讯 · 王宫收购宝石 · 战争传闻 · 矿井水灾 · 粮食短缺',
  ],
];

export function translateText(source: string, locale: Locale): string {
  if (locale === 'en' || !source) return source;

  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const leading = match?.[1] || '';
  const body = (match?.[2] || source).replace(/\s+/g, ' ').trim();
  const trailing = match?.[3] || '';
  if (!body) return source;

  const exact = ZH_CN[body] || ZH_CN_PLAYER_EXPERIENCE[body];
  if (exact) return `${leading}${exact}${trailing}`;

  for (const [pattern, render] of TEMPLATE_RULES) {
    const templateMatch = body.match(pattern);
    if (templateMatch) {
      return `${leading}${render(...templateMatch.slice(1))}${trailing}`;
    }
  }

  for (const [english, chinese] of REPEATED_PHRASES) {
    if (body.includes(english)) {
      return `${leading}${body.split(english).join(chinese)}${trailing}`;
    }
  }

  const token = TOKEN_TRANSLATIONS[body.toUpperCase()];
  return token ? `${leading}${token}${trailing}` : source;
}

export function localeLabel(locale: Locale): string {
  return locale === 'en' ? '中文' : 'EN';
}

export function localeToggleLabel(locale: Locale): string {
  return locale === 'en' ? '切换到中文' : 'Switch to English';
}
