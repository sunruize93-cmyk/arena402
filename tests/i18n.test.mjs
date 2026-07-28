import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadI18n() {
  const filePath = fileURLToPath(new URL('../src/lib/i18n.ts', import.meta.url));
  const playerExperiencePath = fileURLToPath(
    new URL('../src/lib/i18n-player-experience.ts', import.meta.url),
  );
  const compile = (sourcePath) =>
    ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: sourcePath,
    }).outputText;
  const playerExperienceModule = { exports: {} };
  Function('require', 'module', 'exports', compile(playerExperiencePath))(
    undefined,
    playerExperienceModule,
    playerExperienceModule.exports,
  );
  const source = readFileSync(filePath, 'utf8');
  const compiled = compile(filePath);
  const module = { exports: {} };
  Function('require', 'module', 'exports', compiled)(
    (specifier) => {
      if (specifier === './i18n-player-experience') {
        return playerExperienceModule.exports;
      }
      throw new Error(`Unexpected i18n dependency: ${specifier}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

test('English remains the source locale and Chinese translates primary navigation', () => {
  const { translateText } = loadI18n();
  assert.equal(translateText('Agents', 'en'), 'Agents');
  assert.equal(translateText('Agents', 'zh-CN'), '智能体');
  assert.equal(translateText('  Sign In  ', 'zh-CN'), '  登录  ');
});

test('Chinese translation covers demo dialogue and dynamic round labels', () => {
  const { translateText } = loadI18n();
  assert.equal(
    translateText('Two sacks before the northern gate closes.', 'zh-CN'),
    '北门关闭前，我要两袋。',
  );
  assert.equal(translateText('Round 04', 'zh-CN'), '第 04 回合');
  assert.equal(
    translateText("Game demo · King’s Pawnhouse", 'zh-CN'),
    '对局 demo · 王家典当行',
  );
});

test('unknown identifiers and API values are never rewritten', () => {
  const { translateText } = loadI18n();
  assert.equal(translateText('game_8f2a', 'zh-CN'), 'game_8f2a');
  assert.equal(
    translateText('0xE0d802Fbd0b4c248d7E8149856b40Fe4A2d41870', 'zh-CN'),
    '0xE0d802Fbd0b4c248d7E8149856b40Fe4A2d41870',
  );
});

test('Chinese translation covers the Expo broadcast and document metadata', () => {
  const { translateText } = loadI18n();
  assert.equal(
    translateText('FINAL SETTLEMENT PRICES', 'zh-CN'),
    '最终结算价格',
  );
  assert.equal(
    translateText('Cassius · BUY GRAIN', 'zh-CN'),
    'Cassius · 买入 粮食',
  );
  assert.equal(
    translateText('Live Broadcast · Arena 402', 'zh-CN'),
    '实时广播 · Arena 402',
  );
});

test('Chinese translation covers waiting-room and matchmaking states', () => {
  const { translateText } = loadI18n();

  assert.equal(translateText('Waiting room', 'zh-CN'), '候场大厅');
  assert.equal(
    translateText('0 of 10 ready', 'zh-CN'),
    '0 / 10 就绪',
  );
  assert.equal(
    translateText('1 public event · Last event #11462', 'zh-CN'),
    '1 条公开事件 · 最新事件 #11462',
  );
  assert.equal(
    translateText(
      'Matchmaking has not started. The first confirmed player starts the five-minute official-fill clock.',
      'zh-CN',
    ),
    '匹配尚未开始。首位玩家确认席位后，将启动五分钟官方补位计时。',
  );
  assert.equal(translateText('Join matchmaking', 'zh-CN'), '参加匹配');
  assert.equal(translateText('Review my ready seat', 'zh-CN'), '查看我的就绪席位');
  assert.equal(translateText('View waiting room', 'zh-CN'), '查看等待室');
  assert.equal(translateText('Matchmaking receipt', 'zh-CN'), '匹配凭证');
  assert.equal(
    translateText(
      'Your Arena session expired. Sign in again before entering.',
      'zh-CN',
    ),
    '竞技场会话已过期，请重新登录后再参加匹配。',
  );
  assert.equal(
    translateText('Your Agent is READY in the waiting game.', 'zh-CN'),
    '你的智能体已进入等待游戏，并处于就绪状态。',
  );
  assert.equal(
    translateText('Arena starts automatically at', 'zh-CN'),
    '竞技场将在达到以下条件时自动开局：',
  );
  assert.equal(
    translateText('No player start button is required.', 'zh-CN'),
    '玩家不需要点击开始按钮。',
  );
});

test('Chinese translation covers the complete player journey surfaces', () => {
  const { translateText } = loadI18n();

  assert.equal(translateText('Enter the Arena.', 'zh-CN'), '进入竞技场。');
  assert.equal(
    translateText('Username must be at least 3 characters.', 'zh-CN'),
    '用户名至少需要 3 个字符。',
  );
  assert.equal(
    translateText('Current game · Entry desk', 'zh-CN'),
    '当前对局 · 入场台',
  );
  assert.equal(translateText('Treasury wallet', 'zh-CN'), '金库钱包');
  assert.equal(
    translateText('No settlement has reached the public ledger.', 'zh-CN'),
    '尚无结算进入公开账本。',
  );
});

test('Chinese translation covers live market, history, and accessibility copy', () => {
  const { translateText } = loadI18n();

  assert.equal(
    translateText('Back to the previous Arena view', 'zh-CN'),
    '返回上一个 Arena 页面',
  );
  assert.equal(
    translateText('Market chronicle · Four goods', 'zh-CN'),
    '市场纪事 · 四种物品',
  );
  assert.equal(
    translateText('Four-good round price history', 'zh-CN'),
    '四种物品的逐回合价格历史',
  );
  assert.equal(
    translateText('Reconfigure test222', 'zh-CN'),
    '重新配置 test222',
  );
  assert.equal(
    translateText('Cassius · Last seen 2m ago', 'zh-CN'),
    'Cassius · 最后在线 2m ago',
  );
  assert.equal(
    translateText(
      'Revoke Studio PC? Its Connector token and active bindings will stop working.',
      'zh-CN',
    ),
    '确定撤销 Studio PC 吗？其连接器令牌和有效绑定将停止工作。',
  );
  assert.equal(
    translateText(
      'Leave this pool and revoke the unused game mandate?',
      'zh-CN',
    ),
    '确定退出匹配池并撤销未使用的对局支付授权吗？',
  );
});
