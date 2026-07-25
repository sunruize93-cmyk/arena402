'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  approvePairingAuthenticated,
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}

export default function ConnectPage() {
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCode, setUserCode] = useState('');
  const [working, setWorking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) setUserCode(normalizeCode(code));
    getConnectorAuthSession()
      .then(setSession)
      .catch(() => setError('The Arena session could not be checked.'))
      .finally(() => setLoading(false));
  }, []);

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const code = normalizeCode(userCode);
    if (code.length < 4) {
      setError('Enter the code shown by your local Connector.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      await approvePairingAuthenticated(code, session.csrf_token);
      setApproved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'This pairing code could not be approved.',
      );
    } finally {
      setWorking(false);
    }
  }

  const returnTo = `/connect${userCode ? `?code=${encodeURIComponent(userCode)}` : ''}`;

  return (
    <div className="connect-page">
      <Link className="back-btn" href="/agents">
        ← Agent workshop
      </Link>
      <div className="connect-auth-shell">
        <aside>
          <p className="label">Outbound only · Local authority</p>
          <h1 className="display">Open The Workshop Gate.</h1>
          <p>
            Your Connector discovers supported runtimes locally. Arena receives
            only the capabilities you bind—never your local credentials.
          </p>
          <div className="connect-steps">
            <span><b>01</b> Install Connector</span>
            <span><b>02</b> Approve this code</span>
            <span><b>03</b> Bind an Agent</span>
          </div>
        </aside>

        <section>
          {loading ? (
            <div className="deployment-auth-state">
              <span className="deployment-pulse" />
              Checking your Arena seal…
            </div>
          ) : !session ? (
            <div className="connect-login-required">
              <p className="label">Identity required</p>
              <h2>Sign in before approving a computer.</h2>
              <p>
                The device will be owned by your Arena identity and cannot be
                claimed by another account.
              </p>
              <Link
                className="btn"
                href={`/signin?return_to=${encodeURIComponent(returnTo)}`}
              >
                Continue with GitHub
              </Link>
            </div>
          ) : approved ? (
            <div className="connect-approved" aria-live="polite">
              <span className="connect-approved-mark">✓</span>
              <p className="label">Gate opened</p>
              <h2>Your Connector is coming online.</h2>
              <p>
                Return to the Agent workshop to inspect its runtimes and bind
                the piece you want to send into the Arena.
              </p>
              <div className="section-actions">
                <Link className="btn" href="/agents">
                  Finish Agent Binding
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={approve}>
              <p className="label">Authenticated as {session.user.username}</p>
              <h2>Approve this computer</h2>
              <label htmlFor="connector-code">Connector code</label>
              <input
                id="connector-code"
                value={userCode}
                onChange={(event) => setUserCode(normalizeCode(event.target.value))}
                placeholder="ABCD-EFGH"
                autoComplete="one-time-code"
                spellCheck={false}
              />
              <p className="connect-hint">
                Compare this code with the one printed by your local Connector.
                Codes expire and can be used only once.
              </p>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="btn" type="submit" disabled={working}>
                {working ? 'Opening gate…' : 'Approve Connector'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
