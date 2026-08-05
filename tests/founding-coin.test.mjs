import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(
    new URL('../src/components/Founding402Claim.tsx', import.meta.url),
  ),
  'utf8',
);

test('reduced-motion visitors skip the Three.js import and WebGL setup', () => {
  const threeImport = source.indexOf("await import('three')");
  const reducedMotionGuard = source.indexOf(
    "window.matchMedia('(prefers-reduced-motion: reduce)').matches",
    source.indexOf('useEffect(() => {', source.indexOf('function InteractiveMemorialCoin')),
  );
  const setupEffect = source.lastIndexOf('useEffect(() => {', reducedMotionGuard);

  assert.ok(setupEffect >= 0, 'expected the WebGL setup effect');
  assert.ok(
    reducedMotionGuard > setupEffect && reducedMotionGuard < threeImport,
    'the reduced-motion guard must run before importing Three.js',
  );
  assert.match(source, /\}, \[reducedMotion, renderCoin\]\);/);
});
