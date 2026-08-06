import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isConnectorBindingJoinable,
} from '../src/lib/connector-binding-policy.mjs';

test('a reusable Connector Agent remains joinable after its session is running', () => {
  assert.equal(
    isConnectorBindingJoinable({
      agent_id: 'agent-local',
      status: 'available',
    }),
    true,
  );
  assert.equal(
    isConnectorBindingJoinable({
      agent_id: 'agent-local',
      status: 'running',
    }),
    true,
  );
});

test('an unavailable Connector route is not offered for Current Game entry', () => {
  for (const status of ['degraded', 'stopped']) {
    assert.equal(
      isConnectorBindingJoinable({
        agent_id: 'agent-local',
        status,
      }),
      false,
    );
  }
  assert.equal(
    isConnectorBindingJoinable({
      agent_id: null,
      status: 'running',
    }),
    false,
  );
});
