import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  connectorInstallerCommand,
  connectorInstallerUrl,
  isAbsoluteConnectorPath,
} from '../src/lib/connector-installer.mjs';

test('connector installer links use the same-origin download route', () => {
  assert.equal(
    connectorInstallerUrl('windows'),
    '/downloads/install.ps1',
  );
  assert.equal(
    connectorInstallerUrl('linux'),
    '/downloads/install.sh',
  );
});

test('same-origin download route forces reviewed installer filenames', () => {
  const routeSource = readFileSync(
    new URL('../src/app/downloads/[filename]/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(routeSource, /'install\.ps1'/);
  assert.match(routeSource, /'install\.sh'/);
  assert.match(routeSource, /Content-Disposition/);
  assert.match(routeSource, /attachment; filename=/);
  assert.match(routeSource, /text\/plain; charset=utf-8/);
  assert.match(routeSource, /X-Content-Type-Options/);
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
