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

test('conversation projection exposes only allowlisted display fields', () => {
  const { buildConversationEntries } = loadTypeScriptModule(
    new URL('../src/lib/agent-conversation.ts', import.meta.url),
  );
  const entries = buildConversationEntries([
    {
      event_id: 'evt-1',
      event_type: 'runtime.message',
      occurred_at: '2026-07-25T10:00:00Z',
      data: {
        role: 'assistant',
        message: 'I will hold grain until the royal order arrives.',
        api_key: 'must-not-render',
        environment: { SECRET: 'must-not-render' },
      },
    },
    {
      event_id: 'evt-2',
      event_type: 'runtime.task.completed',
      data: { status: 'succeeded', summary: 'Decision submitted.' },
    },
    {
      event_id: 'evt-3',
      event_type: 'runtime.message',
      data: {
        message:
          'Authorization: Bearer sk-this-value-must-never-reach-the-page',
      },
    },
    {
      event_id: 'runtime.secret-id',
      event_type: 'runtime.private_key_super_secret',
      data: {
        public_message: 'must-not-render-public-message',
        unknown: 'must-not-render-unknown',
      },
    },
  ]);

  assert.equal(entries.length, 4);
  assert.equal(entries[0].speaker, 'AGENT');
  assert.match(entries[0].text, /hold grain/);
  assert.doesNotMatch(JSON.stringify(entries), /must-not-render|api_key|SECRET/);
  assert.equal(entries[1].speaker, 'ARENA');
  assert.match(entries[2].text, /REDACTED/);
  assert.doesNotMatch(JSON.stringify(entries), /sk-this-value/);
  assert.equal(entries[3].label, 'RUNTIME EVENT');
  assert.doesNotMatch(
    JSON.stringify(entries[3]),
    /private_key_super_secret|runtime.secret-id|public-message|unknown/,
  );
});
