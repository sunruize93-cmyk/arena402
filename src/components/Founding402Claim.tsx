'use client';

import { ExternalLink, Github, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getMemorialStats,
  getMyMemorial,
  MemorialAward,
  MemorialStats,
  MemorialUnavailable,
} from '@/lib/memorial-api';
import { API_BASE_URL, ArenaApiError } from '@/lib/platform-api';

const REASON_COPY: Record<string, string> = {
  campaign_preparing: 'The Founding registry is being prepared. Return shortly.',
  founding_edition_full: 'All 402 Founding places have been assigned.',
  registration_pending: 'Your GitHub registration is waiting to be recorded.',
  github_identity_required: 'Connect GitHub to claim a Founding place.',
};

type ClaimState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'award'; award: MemorialAward }
  | { kind: 'unavailable'; result: MemorialUnavailable }
  | { kind: 'error'; message: string };

function compactAddress(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default function Founding402Claim() {
  const [stats, setStats] = useState<MemorialStats | null>(null);
  const [claim, setClaim] = useState<ClaimState>({ kind: 'loading' });
  const oauthHref = useMemo(
    () =>
      `${API_BASE_URL}/api/auth/github/start?${new URLSearchParams({
        return_to: '/founding402/claim',
      })}`,
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      getMemorialStats(controller.signal).then(setStats),
      getMyMemorial(controller.signal)
        .then((result) => {
          setClaim(
            result.eligible
              ? { kind: 'award', award: result }
              : { kind: 'unavailable', result },
          );
        })
        .catch((error: unknown) => {
          if (error instanceof ArenaApiError && error.status === 401) {
            setClaim({ kind: 'signed-out' });
            return;
          }
          setClaim({
            kind: 'error',
            message:
              error instanceof ArenaApiError && error.status === 404
                ? 'The Founding registry is not open yet.'
                : 'The registry could not be reached. Try again shortly.',
          });
        }),
    ]);
    return () => controller.abort();
  }, []);

  return (
    <div className="founding-page">
      <section className="founding-hero">
        <div className="founding-copy">
          <p className="label">Genesis registry · Injective testnet</p>
          <h1 className="display founding-title">
            First <em>402</em>
          </h1>
          <p className="founding-lede">
            Link one GitHub identity. The first 402 Arena registrations receive
            a numbered, non-transferable memorial NFT and a dedicated testnet
            wallet—no MetaMask required.
          </p>
          <div className="founding-trust">
            <span>
              <ShieldCheck aria-hidden="true" />
              GitHub proves identity
            </span>
            <span>Wallet credentials stay offline</span>
          </div>
        </div>

        <RegistryMatrix stats={stats} />
      </section>

      <section className="founding-claim" aria-labelledby="claim-heading">
        <header>
          <p className="label">Your founding record</p>
          <h2 className="display" id="claim-heading">
            Claim the mark.
          </h2>
        </header>
        <ClaimPanel claim={claim} oauthHref={oauthHref} />
      </section>

      <section className="founding-rules" aria-label="Claim rules">
        <div>
          <span>Identity</span>
          <strong>One GitHub account</strong>
          <p>Authorization is required. Repository access is never requested.</p>
        </div>
        <div>
          <span>Edition</span>
          <strong>Rank 001—402</strong>
          <p>Registration rank permanently determines the NFT token ID.</p>
        </div>
        <div>
          <span>Custody</span>
          <strong>Offline handoff</strong>
          <p>Seed phrases and private keys never enter this page or the API.</p>
        </div>
      </section>
    </div>
  );
}

function RegistryMatrix({ stats }: { stats: MemorialStats | null }) {
  const reserved = stats?.reserved ?? 0;
  const minted = stats?.minted ?? 0;
  return (
    <aside className="founding-registry" aria-label="Founding edition progress">
      <div className="founding-registry-head">
        <span>Edition ledger</span>
        <span>{String(reserved).padStart(3, '0')} / 402 locked</span>
      </div>
      <div className="founding-matrix" aria-hidden="true">
        {Array.from({ length: 402 }, (_, index) => (
          <i
            className={
              index < minted
                ? 'is-minted'
                : index < reserved
                  ? 'is-reserved'
                  : undefined
            }
            key={index}
          />
        ))}
      </div>
      <div className="founding-registry-foot">
        <span><i className="key-reserved" /> Qualification locked</span>
        <span><i className="key-minted" /> NFT confirmed</span>
      </div>
    </aside>
  );
}

function ClaimPanel({
  claim,
  oauthHref,
}: {
  claim: ClaimState;
  oauthHref: string;
}) {
  if (claim.kind === 'loading') {
    return <div className="founding-panel founding-loading">Reading the registry…</div>;
  }
  if (claim.kind === 'signed-out') {
    return (
      <div className="founding-panel">
        <p className="founding-panel-kicker">No identity linked</p>
        <h3>Connect GitHub to claim.</h3>
        <p>
          GitHub authorization creates or links your Arena identity. You will
          return here automatically to see your result.
        </p>
        <a className="btn founding-github" href={oauthHref}>
          <Github aria-hidden="true" />
          Continue with GitHub
        </a>
      </div>
    );
  }
  if (claim.kind === 'unavailable') {
    return (
      <div className="founding-panel">
        <p className="founding-panel-kicker">Registry response</p>
        <h3>Not assigned yet.</h3>
        <p>{REASON_COPY[claim.result.reason] || 'No Founding record is available.'}</p>
        {claim.result.reason === 'github_identity_required' && (
          <a className="btn founding-github" href={oauthHref}>
            <Github aria-hidden="true" />
            Continue with GitHub
          </a>
        )}
      </div>
    );
  }
  if (claim.kind === 'error') {
    return (
      <div className="founding-panel founding-error" role="alert">
        <p className="founding-panel-kicker">Registry unavailable</p>
        <h3>Claiming is paused.</h3>
        <p>{claim.message}</p>
      </div>
    );
  }

  const { award } = claim;
  const minted = award.status === 'minted';
  return (
    <div className="founding-panel founding-award">
      <div className="founding-award-serial">
        <span>Founding rank</span>
        <strong>#{String(award.registrationRank).padStart(3, '0')}</strong>
        <small>of {award.editionSize}</small>
      </div>
      <dl>
        <div><dt>Token ID</dt><dd>{award.tokenId}</dd></div>
        <div><dt>Wallet</dt><dd title={award.walletAddress}>{compactAddress(award.walletAddress)}</dd></div>
        <div><dt>Qualification</dt><dd>Locked</dd></div>
        <div><dt>NFT status</dt><dd>{minted ? 'Mint confirmed' : 'Awaiting mint'}</dd></div>
      </dl>
      <p className="founding-status-copy">
        {minted
          ? 'Your testnet memorial NFT is confirmed on-chain.'
          : 'Your place and wallet are secured. Minting happens in reviewed batches.'}
      </p>
      {award.tokenUrl && (
        <a
          className="founding-explorer"
          href={award.tokenUrl}
          target="_blank"
          rel="noreferrer"
        >
          View on Blockscout
          <ExternalLink aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
