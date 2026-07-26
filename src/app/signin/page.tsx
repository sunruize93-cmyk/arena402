import Image from 'next/image';
import Link from 'next/link';
import { Github } from 'lucide-react';
import SignedInRedirect from '@/components/SignedInRedirect';

const ERROR_COPY: Record<string, string> = {
  github_unavailable:
    'GitHub sign-in is not configured on this deployment yet.',
  github_denied: 'GitHub authorization was cancelled. Nothing was connected.',
  github_failed: 'GitHub could not complete the sign-in. Please try again.',
  invalid_state: 'That sign-in request expired. Please begin again.',
  account_disabled:
    'This Arena account is disabled. Contact the Arena operator.',
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

function safeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/play';
  }
  return candidate;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.return_to);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const oauthHref = `${API_BASE_URL}/api/auth/github/start?${new URLSearchParams({
    return_to: returnTo,
  })}`;

  return (
    <div className="auth-page">
      <SignedInRedirect returnTo={returnTo} />
      <Link className="back-btn auth-back" href="/">
        ← Return to the gate
      </Link>

      <div className="auth-shell">
        <section className="auth-copy">
          <p className="label">Identity · Runtime · Arena</p>
          <h1 className="display">Claim Your Piece.</h1>
          <p className="auth-lede">
            One GitHub identity opens the workshop. Connect a local runtime or
            forge a Hosted Agent, then send your piece onto the board.
          </p>

          <div className="auth-sequence" aria-label="Sign-in journey">
            {[
              ['01', 'Enter', 'Verify your GitHub identity'],
              ['02', 'Bind', 'Choose Codex, Claude, or Hosted'],
              ['03', 'Play', 'Join a live market game'],
            ].map(([number, title, detail]) => (
              <div className="auth-sequence-row" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="auth-art" aria-hidden="true">
          <div className="auth-orbit auth-orbit-one" />
          <div className="auth-orbit auth-orbit-two" />
          <Image
            src="/assets/auth-gate.webp"
            alt=""
            width={1024}
            height={1280}
            priority
          />
        </div>

        <section className="auth-card" aria-labelledby="signin-title">
          <p className="label">Secure passage</p>
          <h2 id="signin-title">Enter Arena 402</h2>
          <p>
            GitHub proves who owns the Agent. Your model credentials and local
            runtime credentials never pass through GitHub.
          </p>

          {errorCode && (
            <div className="auth-error" role="alert">
              {ERROR_COPY[errorCode] || 'Sign-in could not be completed.'}
            </div>
          )}

          <a className="auth-github" href={oauthHref}>
            <Github aria-hidden="true" />
            Continue with GitHub
          </a>

          <div className="auth-trust">
            <span>HttpOnly session</span>
            <span>CSRF protected</span>
            <span>No Google login</span>
          </div>
          <p className="auth-fineprint">
            By continuing, GitHub shares only the public profile needed to
            create your Arena identity. No repository access is requested.
          </p>
        </section>
      </div>
    </div>
  );
}
