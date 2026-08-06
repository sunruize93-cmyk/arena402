export const DEFAULT_CONNECTOR_DOWNLOAD_ORIGIN = 'https://api.arena402.com';

export function connectorDownloadOrigin(apiOrigin) {
  return (apiOrigin || DEFAULT_CONNECTOR_DOWNLOAD_ORIGIN).replace(/\/$/, '');
}

export function connectorInstallerUrl(platform) {
  const filename = platform === 'linux' ? 'install.sh' : 'install.ps1';
  return `/downloads/${filename}`;
}

export function isAbsoluteConnectorPath(platform, value) {
  const candidate = value.trim();
  if (platform === 'linux') return candidate.startsWith('/');
  return /^[A-Za-z]:[\\/]/.test(candidate) || /^\\\\[^\\]+\\[^\\]+/.test(candidate);
}

function quotePowerShell(value) {
  return `"${value.replaceAll('"', '`"')}"`;
}

function quoteShell(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function connectorInstallerCommand({
  platform,
  apiOrigin,
  enableCodexTasks = false,
  allowRoot = '',
}) {
  const server = connectorDownloadOrigin(apiOrigin);
  if (platform === 'linux') {
    const options = [`--server ${quoteShell(server)}`];
    if (enableCodexTasks && isAbsoluteConnectorPath(platform, allowRoot)) {
      options.push('--enable-codex-tasks', `--allow-root ${quoteShell(allowRoot.trim())}`);
    }
    return `sh ./install-connector.sh ${options.join(' ')}`;
  }

  const options = [`-Server ${quotePowerShell(server)}`];
  if (enableCodexTasks && isAbsoluteConnectorPath(platform, allowRoot)) {
    options.push('-EnableCodexTasks', `-AllowRoot ${quotePowerShell(allowRoot.trim())}`);
  }
  return `.\\install-connector.ps1 ${options.join(' ')}`;
}
