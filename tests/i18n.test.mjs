import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadI18n() {
  const filePath = fileURLToPath(new URL('../src/lib/i18n.ts', import.meta.url));
  const source = readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', compiled)(
    undefined,
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
