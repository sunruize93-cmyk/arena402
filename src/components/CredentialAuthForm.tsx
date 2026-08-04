'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loginArenaUser,
  registerArenaUser,
} from '@/lib/identity-api';
import { ArenaHttpError } from '@/lib/arena-http';
import { useLocale } from '@/components/LocaleProvider';

type AuthMode = 'login' | 'register';

const ERROR_COPY: Record<string, string> = {
  'Invalid username or password':
    'That username and password combination was not accepted.',
  'Username is already registered':
    'That username is already registered. Try signing in instead.',
  'Authentication required': 'Your session expired. Please try again.',
};

function firstError(value: string): string {
  return ERROR_COPY[value] || value || 'The Arena could not complete that request.';
}

export default function CredentialAuthForm({
  returnTo,
  initialMode = 'login',
  registerReturnTo = '/founding402/claim',
  onAuthenticated,
}: {
  returnTo: string;
  initialMode?: AuthMode;
  registerReturnTo?: string;
  onAuthenticated?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { message } = useLocale();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
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

    if (normalizedUsername.length < 3) {
      setError(message('auth.error.username_min'));
      return;
    }
    if (isRegistering && password.length < 12) {
      setError(message('auth.error.password_min'));
      return;
    }
    if (isRegistering && password !== passwordConfirmation) {
      setError(message('auth.error.password_mismatch'));
      return;
    }

    setPending(true);
    try {
      if (isRegistering) {
        await registerArenaUser({
          username: normalizedUsername,
          password,
        });
      } else {
        await loginArenaUser({
          username: normalizedUsername,
          password,
        });
      }
      if (onAuthenticated) {
        await onAuthenticated();
      } else {
        router.replace(isRegistering ? registerReturnTo : returnTo);
        router.refresh();
      }
    } catch (authError) {
      setError(
        authError instanceof ArenaHttpError
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
              placeholder={
                isRegistering
                  ? message('auth.placeholder.password_min')
                  : 'Your password'
              }
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
          ? 'Create a platform account directly. GitHub is optional.'
          : 'Use GitHub below if you already have a GitHub-bound Arena identity.'}
      </p>
    </div>
  );
}
