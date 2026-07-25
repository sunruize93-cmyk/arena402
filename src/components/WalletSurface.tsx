'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';

const ASSETS = [
  {
    symbol: 'INJ',
    name: 'Native balance',
    detail: 'Gas and network settlement',
    state: 'Wallet not linked',
  },
  {
    symbol: '402-G',
    name: 'arena402-g',
    detail: 'Game trading capital',
    state: 'Wallet not linked',
  },
  {
    symbol: '402-M',
    name: 'arena402-m',
    detail: 'Soulbound participation mark',
    state: 'Wallet not linked',
  },
] as const;

const NETWORK_FACTS = [
  ['Network', 'Injective EVM testnet'],
  ['Chain ID', '1439'],
  ['Settlement', 'x402 · EIP-3009'],
  ['Explorer', 'Testnet Blockscout'],
] as const;

function shortUser(session: ConnectorAuthSession | null): string {
  return session?.user.display_name || session?.user.username || 'Unclaimed player';
}

export default function WalletSurface() {
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  async function copyLabel() {
    await navigator.clipboard?.writeText('Wallet binding pending');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="wallet-page site-main">
      <section className="wallet-hero">
        <div className="wallet-hero-copy">
          <Link className="back-btn" href="/">
            ← The Arena gate
          </Link>
          <p className="label">Treasury · Public chain · Player custody</p>
          <h1 className="display wallet-title">The Treasury.</h1>
          <p className="wallet-lede">
            The wallet carries your game capital, your participation mark, and the
            receipts that remain after the bargaining table closes.
          </p>
          <div className="wallet-identity-line">
            <span className="wallet-status-dot" aria-hidden="true" />
            <span>{loading ? 'Checking Arena identity…' : shortUser(session)}</span>
            <span className="wallet-identity-separator">/</span>
            <span>{session ? 'Arena session found' : 'Sign in to bind a wallet'}</span>
          </div>
        </div>

        <aside className="wallet-seal-card" aria-labelledby="wallet-seal-title">
          <div className="wallet-seal-orbit wallet-seal-orbit-one" aria-hidden="true" />
          <div className="wallet-seal-orbit wallet-seal-orbit-two" aria-hidden="true" />
          <div className="wallet-seal-card-top">
            <span className="label">Wallet seal</span>
            <span className="wallet-seal-mark" aria-hidden="true">402</span>
          </div>
          <p className="wallet-seal-state">NOT LINKED</p>
          <h2 id="wallet-seal-title">No address has claimed this treasury.</h2>
          <p>
            Link a player-owned Injective EVM address before Arena can read balances
            or associate settlement receipts with this identity.
          </p>
          <div className="wallet-seal-actions">
            {session ? (
              <button type="button" className="btn wallet-disabled-action" disabled>
                Wallet binding coming next
              </button>
            ) : (
              <Link className="btn" href="/signin?return_to=%2Fwallet">
                Sign in to continue <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
            <button type="button" className="wallet-copy-action" onClick={() => void copyLabel()}>
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy status'}
            </button>
          </div>
        </aside>
      </section>

      <section className="wallet-section wallet-assets" aria-labelledby="assets-title">
        <div className="wallet-section-heading">
          <div>
            <p className="label">The holdings</p>
            <h2 className="display" id="assets-title">What the seal carries.</h2>
          </div>
          <p className="wallet-section-note">
            Read-only until a wallet is linked. Arena never treats an unverified address
            as a player identity.
          </p>
        </div>
        <div className="wallet-asset-grid">
          {ASSETS.map((asset) => (
            <article className="wallet-asset-card" key={asset.symbol}>
              <div className="wallet-asset-mark">{asset.symbol}</div>
              <div>
                <p className="label">{asset.name}</p>
                <h3>—</h3>
                <p className="wallet-asset-detail">{asset.detail}</p>
              </div>
              <span className="wallet-asset-state">{asset.state}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="wallet-section wallet-ledger-grid" aria-label="Wallet facts and activity">
        <article className="wallet-ledger-panel">
          <div className="wallet-panel-heading">
            <div>
              <p className="label">The network</p>
              <h2 className="display">A public chain.</h2>
            </div>
            <ShieldCheck size={24} strokeWidth={1} aria-hidden="true" />
          </div>
          <dl className="wallet-facts">
            {NETWORK_FACTS.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="wallet-panel-footnote">
            The frontend will display the last server-verified block and an explorer
            receipt here once wallet binding is enabled.
          </p>
        </article>

        <article className="wallet-ledger-panel wallet-activity-panel">
          <div className="wallet-panel-heading">
            <div>
              <p className="label">The receipts</p>
              <h2 className="display">Nothing sealed.</h2>
            </div>
            <ExternalLink size={22} strokeWidth={1} aria-hidden="true" />
          </div>
          <div className="wallet-empty-state">
            <span className="wallet-empty-line" aria-hidden="true" />
            <p>No wallet-linked settlements yet.</p>
            <span>Trade receipts will appear here after chain confirmation.</span>
          </div>
          <Link className="wallet-text-link" href="/game">
            Watch a public table <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="wallet-principles" aria-label="Wallet principles">
        <div><span>01</span><strong>Player custody</strong><p>Your signing key stays in your wallet.</p></div>
        <div><span>02</span><strong>Server verification</strong><p>A claimed address is checked before it becomes identity.</p></div>
        <div><span>03</span><strong>Public receipts</strong><p>Settlement is only final after the chain confirms it.</p></div>
      </section>
    </div>
  );
}
