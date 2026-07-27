import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTypeScriptModule(path) {
  const filePath = path instanceof URL ? fileURLToPath(path) : path;
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

test('historical rankings prefer the frozen Agent display name', () => {
  const { rankingAgentIdentity } = loadTypeScriptModule(
    new URL('../src/lib/game-display.ts', import.meta.url),
  );

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
  const { rankingAgentIdentity } = loadTypeScriptModule(
    new URL('../src/lib/game-display.ts', import.meta.url),
  );

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
