'use client';

import Image from 'next/image';
import { ExternalLink, Github, ShieldCheck, X } from 'lucide-react';
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
  const [showAwardModal, setShowAwardModal] = useState(false);
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

  const shouldPoll =
    claim.kind === 'award' && claim.award.status !== 'minted';

  useEffect(() => {
    if (!shouldPoll) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void Promise.allSettled([
        getMemorialStats(controller.signal).then(setStats),
        getMyMemorial(controller.signal).then((result) => {
          setClaim(
            result.eligible
              ? { kind: 'award', award: result }
              : { kind: 'unavailable', result },
          );
        }),
      ]);
    }, 3_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [shouldPoll]);

  useEffect(() => {
    if (claim.kind !== 'award') return;
    const seenKey = `founding402-award-${claim.award.tokenId}`;
    if (window.sessionStorage.getItem(seenKey)) return;
    window.sessionStorage.setItem(seenKey, 'shown');
    setShowAwardModal(true);
  }, [claim]);

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
      {showAwardModal && claim.kind === 'award' && (
        <AwardModal
          award={claim.award}
          onClose={() => setShowAwardModal(false)}
        />
      )}
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
  const submitted = award.status === 'submitted';
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
        <div>
          <dt>NFT status</dt>
          <dd>
            {minted
              ? 'Mint confirmed'
              : submitted
                ? 'Confirming on-chain'
                : 'Queued for mint'}
          </dd>
        </div>
      </dl>
      <p className="founding-status-copy">
        {minted
          ? 'Your testnet memorial NFT is confirmed on-chain.'
          : submitted
            ? 'Your mint transaction is live. This record refreshes automatically.'
            : 'Your place and wallet are secured. Minting will begin automatically.'}
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

function AwardModal({
  award,
  onClose,
}: {
  award: MemorialAward;
  onClose: () => void;
}) {
  const minted = award.status === 'minted';
  const submitted = award.status === 'submitted';
  return (
    <div
      className="founding-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="founding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="founding-modal-title"
      >
        <button
          className="founding-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close Founding record"
        >
          <X aria-hidden="true" />
        </button>
        <p className="label">Arena 402 · Genesis registry</p>
        <div className="founding-coin">
          <Image
            src="/assets/arena402-memorial-coin.png"
            width={250}
            height={250}
            priority
            alt="Arena 402 gold pawn memorial coin"
          />
        </div>
        <p className="founding-modal-rank">
          Founding #{String(award.registrationRank).padStart(3, '0')}
        </p>
        <h2 className="display" id="founding-modal-title">
          {minted ? 'Memorial minted.' : 'Your place is secured.'}
        </h2>
        <p className="founding-modal-copy">
          {minted
            ? `Token ${award.tokenId} is confirmed in your dedicated Arena wallet.`
            : submitted
              ? `Token ${award.tokenId} is being confirmed on Injective testnet.`
              : `Token ${award.tokenId} is queued for immediate testnet minting.`}
        </p>
        <div className="founding-modal-status" aria-live="polite">
          <i className={minted ? 'is-confirmed' : submitted ? 'is-live' : undefined} />
          {minted
            ? 'NFT confirmed'
            : submitted
              ? 'Transaction submitted'
              : 'Qualification locked'}
        </div>
        <button className="btn founding-modal-action" type="button" onClick={onClose}>
          View my record
        </button>
      </section>
    </div>
  );
}
