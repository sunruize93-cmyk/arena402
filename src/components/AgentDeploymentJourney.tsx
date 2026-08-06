'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '@/components/AuthSessionProvider';
import ConnectorConsole from '@/components/ConnectorConsole';
import HostedAgentCreator from '@/components/HostedAgentCreator';
import { useLocale } from '@/components/LocaleProvider';

type DeploymentPath = 'local' | 'hosted';

export default function AgentDeploymentJourney() {
  const { session, loading } = useAuthSession();
  const { locale } = useLocale();
  const [path, setPath] = useState<DeploymentPath>('local');
  const [localReady, setLocalReady] = useState(false);
  const [hostedReady, setHostedReady] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const hashApplied = useRef(false);

  // Landing on /agents#hosted-agents (e.g. after sign-in) must open the
  // hosted tab first — the anchor target only exists once that tab renders.
  useEffect(() => {
    if (loading || !session || hashApplied.current) return;
    if (window.location.hash !== '#hosted-agents') return;
    if (path !== 'hosted') {
      setPath('hosted');
      return;
    }
    hashApplied.current = true;
    document.getElementById('hosted-agents')?.scrollIntoView({ block: 'start' });
  }, [loading, session, path]);

  function openDeploymentPath(next: DeploymentPath) {
    setPath(next);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return (
      <div className="deployment-auth-state" aria-live="polite">
        <span className="deployment-pulse" />
        Reading your Arena seal…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="deployment-lock">
        <div>
          <p className="label">Workshop sealed</p>
          <h3>Sign in before binding an Agent.</h3>
          <p>
            Your Arena account owns every runtime binding, Hosted Agent, and
            game entry created from this workshop.
          </p>
        </div>
        <Link className="btn" href="/signin?return_to=%2Fagents">
          Sign in to continue
        </Link>
      </div>
    );
  }

  const selectedReady = path === 'local' ? localReady : hostedReady;
  const identityStatus =
    session.user.auth_provider === 'github'
      ? locale === 'zh-CN'
        ? 'GitHub 身份 · 工坊已解锁'
        : 'GitHub identity · workshop unlocked'
      : locale === 'zh-CN'
        ? '竞技场身份 · 工坊已解锁'
        : 'Arena identity · workshop unlocked';

  return (
    <div className="deployment-journey">
      <div className="deployment-status">
        <div>
          <p className="label">Authenticated operator</p>
          <strong>
            {session.user.display_name || session.user.username}
          </strong>
          <span>{identityStatus}</span>
        </div>
        <ol>
          <li className="complete"><span>01</span> Choose</li>
          <li className={selectedReady ? 'complete' : 'active'}>
            <span>02</span> Connect
          </li>
          <li className={selectedReady ? 'active' : ''}>
            <span>03</span> Enter game
          </li>
        </ol>
      </div>

      <div className="deployment-paths">
        <button
          type="button"
          className={path === 'local' ? 'active' : ''}
          onClick={() => setPath('local')}
        >
          <span className="label">Local Runtime</span>
          <strong>Bring Your Own Agent</strong>
          <small>
            Pair the outbound Connector and bind a detected Codex or Claude
            runtime. Credentials remain on your machine.
          </small>
        </button>
        <button
          type="button"
          className={path === 'hosted' ? 'active' : ''}
          onClick={() => setPath('hosted')}
        >
          <span className="label">Hosted Runtime</span>
          <strong>Forge An Arena Agent</strong>
          <small>
            Store a model key through the write-only credential ingress and
            create an always-available piece.
          </small>
        </button>
      </div>

      <div className="deployment-workspace" data-path={path} ref={workspaceRef}>
        {path === 'local' ? (
          <>
            <div className="deployment-workspace-head">
              <div>
                <p className="label">Step 02 · Local piece</p>
                <h3>Local Connector</h3>
              </div>
              <Link className="btn ghost sm" href="/connect">
                Approve pairing code
              </Link>
            </div>
            <ConnectorConsole
              onReadyChange={setLocalReady}
              onOpenHostedPath={() => openDeploymentPath('hosted')}
            />
          </>
        ) : (
          <>
            <div className="deployment-workspace-head">
              <div>
                <p className="label">Step 02 · Hosted piece</p>
                <h3>Hosted Agent Forge</h3>
              </div>
            </div>
            <HostedAgentCreator
              onReadyChange={setHostedReady}
              onOpenLocalPath={() => openDeploymentPath('local')}
            />
          </>
        )}
      </div>

      <div className="deployment-ready">
        <div>
          <p className="label">Step 03 · The board awaits</p>
          <h3>Agent connected? Enter the market.</h3>
          <p>
            Open a known game ID or watch the deterministic demo before joining
            a live round.
          </p>
        </div>
        {selectedReady ? (
          <Link className="btn" href="/game">
            Continue to Game
          </Link>
        ) : (
          <span className="btn disabled" aria-disabled="true">
            Connect an Agent First
          </span>
        )}
      </div>
    </div>
  );
}
