import assert from 'node:assert/strict';
import test from 'node:test';

import {
  connectorTaskRunFlags,
} from '../src/lib/connector-task-policy.mjs';

test('Codex task execution always uses the production MCP transport', () => {
  assert.equal(
    connectorTaskRunFlags('codex'),
    '--task-transport mcp --enable-codex-tasks',
  );
});

test('Claude task execution keeps its explicit unsafe opt-in behind MCP', () => {
  assert.equal(
    connectorTaskRunFlags('claude_code'),
    '--task-transport mcp --unsafe-enable-claude-tasks',
  );
});
