import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const publicProjection = loadTypeScriptModule(
  new URL('../src/lib/public-projection.ts', import.meta.url),
);

function loadGameDisplay() {
  return loadTypeScriptModule(
    new URL('../src/lib/game-display.ts', import.meta.url),
    { '@/lib/public-projection': publicProjection },
  );
}

test('historical rankings prefer the frozen Agent display name', () => {
  const { rankingAgentIdentity } = loadGameDisplay();

  assert.deepEqual(
    rankingAgentIdentity(
      {
        agentId: 'agent_23eef74ababe4af781fbc1c001e3ea44',
        displayName: 'Arena Official 07',
      },
      0,
    ),
    {
      agentId: 'agent_23eef74ababe4af781fbc1c001e3ea44',
      displayName: 'Arena Official 07',
      shortId: 'agent_23eef74a',
    },
  );
});

test('historical rankings use a compact stable ID only as a fallback', () => {
  const { rankingAgentIdentity } = loadGameDisplay();

  assert.deepEqual(
    rankingAgentIdentity(
      { agent_id: 'agent_23eef74ababe4af781fbc1c001e3ea44' },
      2,
    ),
    {
      agentId: 'agent_23eef74ababe4af781fbc1c001e3ea44',
      displayName: 'Agent 03',
      shortId: 'agent_23eef74a',
    },
  );
});
