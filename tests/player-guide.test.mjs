import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
