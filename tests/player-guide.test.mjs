import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(
  fileURLToPath(new URL('../src/app/page.tsx', import.meta.url)),
  'utf8',
);
const guideSource = readFileSync(
  fileURLToPath(new URL('../src/app/guide/page.tsx', import.meta.url)),
  'utf8',
);
const manualSource = readFileSync(
  fileURLToPath(new URL('../src/app/guide/manual/page.tsx', import.meta.url)),
  'utf8',
);
const manualContentPath = fileURLToPath(
  new URL('../src/components/TextManualContent.tsx', import.meta.url),
);
const manualContentSource = existsSync(manualContentPath)
  ? readFileSync(manualContentPath, 'utf8')
  : '';

test('home hero exposes the Player Guide route beside the game entry', () => {
  assert.match(
    homeSource,
    /<Link className="btn ghost sm" href="\/guide">\s*Player Guide\s*<\/Link>/,
  );
});

test('Player Guide covers the complete website-first match journey', () => {
  for (const route of [
    '/play',
    '/agents',
    '/game',
    '/market',
    '/rankings',
    '/ledger',
    '/wallet',
  ]) {
    assert.match(guideSource, new RegExp(`href: '${route.replaceAll('/', '\\/')}'|href="${route}"`));
  }

  assert.match(guideSource, /Choose a READY Agent/);
  assert.match(guideSource, /Wait for automatic start/);
  assert.match(guideSource, /cash \+ grain × 2 \+ iron × 5 \+ warhorse × 8 \+ gems × 3 = 20/);
});

test('Player Guide keeps acceptance separate from completed settlement', () => {
  assert.match(guideSource, /accepted_pending_settlement/);
  assert.match(guideSource, /inventory_committed \/ settled/);
  assert.match(
    guideSource,
    /Acceptance alone does not move inventory/,
  );
});

test('Player Guide links to the plain-text manual beside the entry actions', () => {
  assert.match(
    guideSource,
    /<Link className="btn ghost" href="\/guide\/manual">\s*Text Manual\s*<\/Link>/,
  );
});

test('Text Manual carries the top-down match loop and core rules', () => {
  assert.match(manualContentSource, /READY AGENT/);
  assert.match(manualContentSource, /DECIDE.*buy \/ sell \/ pass/);
  assert.match(manualContentSource, /targeted RFQ/);
  assert.match(manualContentSource, /NEGOTIATE/);
  assert.match(manualContentSource, /INJECTIVE TESTNET/);
  assert.match(manualContentSource, /RANKING/);
  assert.match(
    manualContentSource,
    /net worth = cash \+ Σ holdings × final prices/,
  );
});

test('Text Manual is complete in zh-CN, including both plain-text diagrams', () => {
  assert.match(manualSource, /TextManualContent/);
  assert.match(manualContentSource, /useLocale/);
  assert.match(manualContentSource, /阅读后即可开局。/);
  assert.match(manualContentSource, /文字手册 · Arena 402/);
  assert.match(manualContentSource, /Arena 402 一页式文字规则手册/);
  assert.match(manualContentSource, /document\.title = copy\.documentTitle/);
  assert.match(manualContentSource, /已就绪智能体/);
  assert.match(manualContentSource, /每回合 · 重复 N 次/);
  assert.match(manualContentSource, /你的智能体运行时/);
  assert.match(manualContentSource, /规则，共十条/);
  assert.match(manualContentSource, /安全说明，共四条/);
  assert.doesNotMatch(manualContentSource, /data-i18n-ignore/);
});

test('Text Manual scopes credential and real-cost safety claims accurately', () => {
  assert.match(
    manualContentSource,
    /dedicated write-only credential ingress/,
  );
  assert.match(
    manualContentSource,
    /model provider may still bill API usage/,
  );
  assert.doesNotMatch(
    manualContentSource,
    /model key into strategy text, chat, or any form/,
  );
  assert.doesNotMatch(
    manualContentSource,
    /your keys never reach arena, the database, logs, or the model/,
  );
});
