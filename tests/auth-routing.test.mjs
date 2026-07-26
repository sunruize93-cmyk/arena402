import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../src/app/signin/page.tsx', import.meta.url),
  'utf8',
);

test('invite registration defaults back to the memorial claim page', () => {
  assert.match(source, /fallback = '\/play'/);
  assert.match(
    source,
    /inviteCode \? '\/founding402\/claim' : '\/play'/,
  );
  assert.match(source, /safeReturnTo\(\s*params\.return_to,/s);
});

test('explicit return_to remains the highest-priority redirect', () => {
  assert.match(source, /const returnTo = safeReturnTo\(/);
  assert.match(source, /params\.return_to,/);
  assert.match(source, /return candidate;/);
});
