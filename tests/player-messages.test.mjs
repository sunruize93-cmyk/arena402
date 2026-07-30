import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

const messages = loadTypeScriptModule(
  new URL('../src/lib/player-messages.ts', import.meta.url),
);

test('typed player messages localize native dialogs and preserve dynamic names', () => {
  assert.equal(
    messages.playerMessage('en', 'confirm.connector_revoke', {
      deviceName: 'Codex-01',
    }),
    'Revoke Codex-01? Its Connector token and active bindings will stop working.',
  );
  assert.equal(
    messages.playerMessage('zh-CN', 'confirm.connector_revoke', {
      deviceName: 'Codex-01',
    }),
    '确定撤销 Codex-01 吗？其 Connector 令牌和当前绑定将立即停止工作。',
  );
});

test('typed player messages cover non-DOM validation copy', () => {
  assert.equal(
    messages.playerMessage('zh-CN', 'auth.placeholder.password_min'),
    '至少 12 个字符',
  );
  assert.equal(
    messages.playerMessage('zh-CN', 'auth.error.password_mismatch'),
    '两次输入的密码不一致。',
  );
});
