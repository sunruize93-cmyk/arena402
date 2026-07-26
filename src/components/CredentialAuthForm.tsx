'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ConnectorApiError,
  loginConnectorUser,
  registerConnectorUser,
} from '@/lib/connector-api';

type AuthMode = 'login' | 'register';

const ERROR_COPY: Record<string, string> = {
  'Invalid username or password':
    'That username and password combination was not accepted.',
  'Username is already registered':
    'That username is already registered. Try signing in instead.',
  'Invalid or already used invite':
    'This invite code is invalid or has already been used.',
  'Authentication required': 'Your session expired. Please try again.',
};

function firstError(value: string): string {
  return ERROR_COPY[value] || value || 'The Arena could not complete that request.';
}

export default function CredentialAuthForm({
  returnTo,
  initialMode = 'login',
  initialInviteCode = '',
}: {
  returnTo: string;
  initialMode?: AuthMode;
  initialInviteCode?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const isRegistering = mode === 'register';

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setPassword('');
    setPasswordConfirmation('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedInviteCode = inviteCode.trim();

    if (normalizedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (isRegistering && normalizedInviteCode.length < 20) {
      setError('Enter the invite code from your Arena registration link.');
      return;
    }
    if (isRegistering && password.length < 12) {
      setError('Registration passwords must be at least 12 characters.');
      return;
    }
    if (isRegistering && password !== passwordConfirmation) {
      setError('The password confirmation does not match.');
      return;
    }

    setPending(true);
    try {
      if (isRegistering) {
        await registerConnectorUser({
          invite_code: normalizedInviteCode,
          username: normalizedUsername,
          password,
        });
      } else {
        await loginConnectorUser({
          username: normalizedUsername,
          password,
        });
      }
      router.replace(returnTo);
      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof ConnectorApiError
          ? firstError(authError.message)
          : 'The Arena could not complete that request. Try again shortly.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="credential-auth">
      <div className="auth-mode-switch" role="tablist" aria-label="Account access mode">
        <button
          className={mode === 'login' ? 'is-active' : ''}
          onClick={() => switchMode('login')}
          role="tab"
          aria-selected={mode === 'login'}
          type="button"
        >
          Sign in
        </button>
        <button
          className={mode === 'register' ? 'is-active' : ''}
          onClick={() => switchMode('register')}
          role="tab"
          aria-selected={mode === 'register'}
          type="button"
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="arena-username">Username</label>
        <input
          autoComplete="username"
          id="arena-username"
          maxLength={64}
          minLength={3}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your-arena-name"
          required
          value={username}
        />

        <label htmlFor="arena-password">Password</label>
        <input
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          id="arena-password"
          minLength={isRegistering ? 12 : 1}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={isRegistering ? '12 characters minimum' : 'Your password'}
          required
          type="password"
          value={password}
        />

        {isRegistering && (
          <>
            <label htmlFor="arena-password-confirmation">Confirm password</label>
            <input
              autoComplete="new-password"
              id="arena-password-confirmation"
              minLength={12}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Repeat your password"
              required
              type="password"
              value={passwordConfirmation}
            />

            <label htmlFor="arena-invite-code">Invite code</label>
            <input
              autoCapitalize="none"
              autoComplete="off"
              id="arena-invite-code"
              minLength={20}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Paste the code from your invite"
              required
              spellCheck={false}
              value={inviteCode}
            />
            <p className="auth-form-hint">
              Registration is currently invite-gated. A future QR campaign can
              prefill this code automatically.
            </p>
          </>
        )}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <button className="auth-submit" disabled={pending} type="submit">
          {pending
            ? isRegistering
              ? 'Creating account…'
              : 'Opening session…'
            : isRegistering
              ? 'Create Arena account'
              : 'Enter Arena'}
        </button>
      </form>

      <p className="auth-form-note">
        {isRegistering
          ? 'Your session is created immediately after registration.'
          : 'Use GitHub below if you already have a GitHub-bound Arena identity.'}
      </p>
    </div>
  );
}
