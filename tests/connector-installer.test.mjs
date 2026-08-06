import assert from 'node:assert/strict';
import test from 'node:test';

import {
  connectorInstallerCommand,
  connectorInstallerUrl,
  isAbsoluteConnectorPath,
} from '../src/lib/connector-installer.mjs';

test('connector installer URLs use the Arena API download origin', () => {
  assert.equal(
    connectorInstallerUrl('windows', 'https://api.arena402.com/'),
    'https://api.arena402.com/downloads/install.ps1',
  );
  assert.equal(
    connectorInstallerUrl('linux', 'https://api.arena402.com'),
    'https://api.arena402.com/downloads/install.sh',
  );
});

test('Windows task-enabled install command freezes the selected allow-root', () => {
  assert.equal(
    connectorInstallerCommand({
      platform: 'windows',
      apiOrigin: 'https://api.arena402.com',
      enableCodexTasks: true,
      allowRoot: 'C:\\Arena Workspaces\\pawn-one',
    }),
    '.\\install-connector.ps1 -Server "https://api.arena402.com" -EnableCodexTasks -AllowRoot "C:\\Arena Workspaces\\pawn-one"',
  );
});

test('Linux detection-only install command does not silently enable tasks', () => {
  assert.equal(
    connectorInstallerCommand({
      platform: 'linux',
      apiOrigin: '',
      enableCodexTasks: false,
      allowRoot: '/srv/arena',
    }),
    "sh ./install-connector.sh --server 'https://api.arena402.com'",
  );
});

test('task-enabled commands accept only platform-absolute workspace paths', () => {
  assert.equal(isAbsoluteConnectorPath('windows', 'C:\\Arena\\pawn-one'), true);
  assert.equal(isAbsoluteConnectorPath('windows', '.\\Arena\\pawn-one'), false);
  assert.equal(isAbsoluteConnectorPath('linux', '/srv/arena/pawn-one'), true);
  assert.equal(isAbsoluteConnectorPath('linux', 'srv/arena/pawn-one'), false);

  assert.equal(
    connectorInstallerCommand({
      platform: 'linux',
      apiOrigin: 'https://api.arena402.com',
      enableCodexTasks: true,
      allowRoot: 'relative/workspace',
    }),
    "sh ./install-connector.sh --server 'https://api.arena402.com'",
  );
});
