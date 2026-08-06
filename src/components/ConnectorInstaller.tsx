'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCheck2,
  Monitor,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import {
  connectorInstallerCommand,
  connectorInstallerUrl,
  isAbsoluteConnectorPath,
} from '@/lib/connector-installer.mjs';

type InstallerPlatform = 'windows' | 'linux';
type HostPlatform = InstallerPlatform | 'macos' | 'unknown';

interface ConnectorInstallerProps {
  apiOrigin: string;
  hasRegisteredDevice: boolean;
  hasOnlineDevice: boolean;
  hasTaskReadyRuntime: boolean;
  hasJoinableBinding: boolean;
}

function detectHostPlatform(): HostPlatform {
  const identity = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (identity.includes('win')) return 'windows';
  if (identity.includes('linux') || identity.includes('x11')) return 'linux';
  if (identity.includes('mac')) return 'macos';
  return 'unknown';
}

export default function ConnectorInstaller({
  apiOrigin,
  hasRegisteredDevice,
  hasOnlineDevice,
  hasTaskReadyRuntime,
  hasJoinableBinding,
}: ConnectorInstallerProps) {
  const [platform, setPlatform] = useState<InstallerPlatform>('windows');
  const [hostPlatform, setHostPlatform] = useState<HostPlatform>('unknown');
  const [enableCodexTasks, setEnableCodexTasks] = useState(false);
  const [allowRoot, setAllowRoot] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const detected = detectHostPlatform();
    setHostPlatform(detected);
    if (detected === 'windows' || detected === 'linux') setPlatform(detected);
  }, []);

  const command = useMemo(
    () =>
      connectorInstallerCommand({
        platform,
        apiOrigin,
        enableCodexTasks,
        allowRoot,
      }),
    [allowRoot, apiOrigin, enableCodexTasks, platform],
  );
  const copyDisabled =
    enableCodexTasks && !isAbsoluteConnectorPath(platform, allowRoot);

  async function copyCommand() {
    if (copyDisabled || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      return;
    }
  }

  const stages = [
    {
      label: 'Install & launch',
      detail: hasRegisteredDevice ? 'Device registered' : 'Required on this computer',
      complete: hasRegisteredDevice,
      active: !hasRegisteredDevice,
    },
    {
      label: 'Pair device',
      detail: hasOnlineDevice ? 'Connector online' : 'Approve the matching code',
      complete: hasOnlineDevice,
      active: hasRegisteredDevice && !hasOnlineDevice,
    },
    {
      label: 'Ready runtime',
      detail: hasTaskReadyRuntime ? 'Task execution enabled' : 'Detection is not enough',
      complete: hasTaskReadyRuntime,
      active: hasOnlineDevice && !hasTaskReadyRuntime,
    },
    {
      label: 'Bind workspace',
      detail: hasJoinableBinding ? 'Ready for Arena games' : 'Freeze one allowed directory',
      complete: hasJoinableBinding,
      active: hasTaskReadyRuntime && !hasJoinableBinding,
    },
  ];

  return (
    <div className="connector-onboarding">
      <ol className="connector-onboarding-rail" aria-label="Local Connector setup progress">
        {stages.map((stage, index) => (
          <li
            key={stage.label}
            className={stage.complete ? 'complete' : stage.active ? 'active' : ''}
          >
            <span className="connector-step-number">
              {stage.complete ? <Check aria-hidden="true" /> : String(index + 1).padStart(2, '0')}
            </span>
            <span>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </span>
          </li>
        ))}
      </ol>

      <section className="connector-install-manifest" aria-labelledby="connector-install-heading">
        <div className="connector-install-copy">
          <p className="label">Step 01 · Local machine</p>
          <h3 id="connector-install-heading">Install the Arena Connector</h3>
          <p>
            Download the reviewed installer, choose the local authority you grant,
            then run the generated command. The installer verifies the Connector
            binary before installing a current-user startup service.
          </p>

          <div className="connector-platform-tabs" aria-label="Connector operating system">
            {(['windows', 'linux'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={platform === option ? 'active' : ''}
                aria-pressed={platform === option}
                onClick={() => setPlatform(option)}
              >
                <Monitor aria-hidden="true" />
                {option === 'windows' ? 'Windows' : 'Linux'}
              </button>
            ))}
          </div>

          {hostPlatform === 'macos' && (
            <p className="connector-platform-warning" role="status">
              A macOS installer is not available yet. Use a supported Windows or Linux machine.
            </p>
          )}

          <label className="connector-permission-toggle">
            <input
              type="checkbox"
              checked={enableCodexTasks}
              onChange={(event) => setEnableCodexTasks(event.target.checked)}
            />
            <span>
              <strong>Enable Connector-managed Codex tasks</strong>
              <small>
                Explicitly allows Arena tasks inside one directory. Leave off for detection-only setup.
              </small>
            </span>
          </label>

          {enableCodexTasks && (
            <label className="connector-root-field">
              <span>Allowed Arena workspace</span>
              <input
                value={allowRoot}
                onChange={(event) => setAllowRoot(event.target.value)}
                placeholder={
                  platform === 'windows'
                    ? 'C:\\absolute\\path\\to\\arena-workspace'
                    : '/absolute/path/to/arena-workspace'
                }
                spellCheck={false}
                autoComplete="off"
              />
              <small>Use the narrowest absolute path needed for Arena-managed sessions.</small>
            </label>
          )}
        </div>

        <div className="connector-install-receipt">
          <div className="connector-install-receipt-head">
            <span><TerminalSquare aria-hidden="true" /> Installation manifest</span>
            <span>{platform === 'windows' ? 'PowerShell' : 'Shell'}</span>
          </div>
          <a
            className="connector-download"
            href={connectorInstallerUrl(platform, apiOrigin)}
            target="_blank"
            rel="noreferrer"
          >
            <Download aria-hidden="true" />
            Download {platform === 'windows' ? 'install-connector.ps1' : 'install-connector.sh'}
          </a>
          <p className="connector-review-note">
            <FileCheck2 aria-hidden="true" /> Review the downloaded script before running it.
          </p>
          <button
            type="button"
            className="connector-install-command"
            onClick={copyCommand}
            disabled={copyDisabled}
            title="Copy reviewed installer command"
          >
            <code>{command}</code>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button>
          {copyDisabled && (
            <p className="connector-command-blocked" role="status">
              Enter a valid absolute workspace path to generate the task-enabled command.
            </p>
          )}
          <div className="connector-install-safety">
            <ShieldCheck aria-hidden="true" />
            <p>
              Credentials remain local. No inbound port is opened. Claude can be detected,
              but production task execution is not enabled by this installer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
