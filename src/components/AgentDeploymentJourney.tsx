'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ConnectorConsole from '@/components/ConnectorConsole';
import HostedAgentCreator from '@/components/HostedAgentCreator';
import {
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';

type DeploymentPath = 'local' | 'hosted';

export default function AgentDeploymentJourney() {
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<DeploymentPath>('local');
  const [localReady, setLocalReady] = useState(false);
  const [hostedReady, setHostedReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getConnectorAuthSession()
      .then((value) => {
        if (!cancelled) setSession(value);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            Your GitHub identity owns every runtime binding, Hosted Agent, and
            game entry created from this workshop.
          </p>
        </div>
        <Link className="btn" href="/signin?return_to=%2Fagents">
          Continue with GitHub
        </Link>
      </div>
    );
  }

  const selectedReady = path === 'local' ? localReady : hostedReady;

  return (
    <div className="deployment-journey">
      <div className="deployment-status">
        <div>
          <p className="label">Authenticated operator</p>
          <strong>
            {session.user.display_name || session.user.username}
          </strong>
          <span>GitHub identity · workshop unlocked</span>
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

      <div className="deployment-workspace">
        {path === 'local' ? (
          <>
            <div className="deployment-workspace-head">
              <div>
                <p className="label">Step 02 · Local piece</p>
                <h3>Connector Workshop</h3>
              </div>
              <Link className="btn ghost sm" href="/connect">
                Approve pairing code
              </Link>
            </div>
            <ConnectorConsole onReadyChange={setLocalReady} />
          </>
        ) : (
          <>
            <div className="deployment-workspace-head" id="hosted-agents">
              <div>
                <p className="label">Step 02 · Hosted piece</p>
                <h3>Hosted Forge</h3>
              </div>
            </div>
            <HostedAgentCreator onReadyChange={setHostedReady} />
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
