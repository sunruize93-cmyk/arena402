'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';
import {
  WalletApiError,
  WalletOverview,
  createWalletChallenge,
  deleteWalletBinding,
  getWalletBinding,
  getWalletOverview,
  verifyWalletChallenge,
} from '@/lib/wallet-api';

const NETWORK_FACTS = [
  ['Network', 'Injective EVM testnet'],
  ['Chain ID', '1439'],
  ['Settlement', 'x402 / EIP-3009'],
  ['Explorer', 'Testnet Blockscout'],
] as const;

const INJECTIVE_CHAIN_ID = 1439;
const INJECTIVE_CHAIN_ID_HEX = '0x59f';

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function shortUser(session: ConnectorAuthSession | null): string {
  return session?.user.display_name || session?.user.username || 'Unclaimed player';
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function walletErrorMessage(error: unknown): string {
  if (error instanceof WalletApiError) {
    const messages: Record<string, string> = {
      wallet_not_bound: 'No wallet is linked to this Arena identity yet.',
      unsupported_wallet_chain: 'Switch your wallet to Injective EVM Testnet (chain 1439).',
      wallet_signature_invalid: 'The wallet signature could not be verified.',
      wallet_signature_address_mismatch: 'The signature does not belong to this wallet address.',
      challenge_message_mismatch: 'The wallet challenge expired or was changed.',
      wallet_already_bound: 'This Arena identity already has a wallet linked.',
      wallet_address_already_bound: 'This wallet is already linked to another Arena identity.',
      network_unavailable: 'The Arena API is unreachable. Check the local backend and retry.',
    };
    return messages[error.code] || error.message;
  }
  return error instanceof Error ? error.message : 'Wallet binding failed. Please retry.';
}

function ethereumProvider(): EthereumProvider {
  if (!window.ethereum) {
    throw new Error('No browser wallet was found. Install MetaMask or use WalletConnect.');
  }
  return window.ethereum;
}

export default function WalletSurface() {
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      try {
        const value = await getConnectorAuthSession();
        if (cancelled) return;
        setSession(value);
        if (!value) return;

        try {
          await getWalletBinding();
          const walletOverview = await getWalletOverview();
          if (!cancelled) setOverview(walletOverview);
        } catch (walletError) {
          if (walletError instanceof WalletApiError && walletError.status === 404) return;
          throw walletError;
        }
      } catch (loadError) {
        if (!cancelled) setError(walletErrorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  async function linkWallet() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const provider = ethereumProvider();
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : '';
      if (!address) throw new Error('The wallet did not return an address.');

      const chainId = await provider.request({ method: 'eth_chainId' });
      if (typeof chainId !== 'string' || chainId.toLowerCase() !== INJECTIVE_CHAIN_ID_HEX) {
        throw new Error(`Switch your wallet to Injective EVM Testnet (chain ${INJECTIVE_CHAIN_ID}).`);
      }

      const challenge = await createWalletChallenge({
        address,
        chainId: INJECTIVE_CHAIN_ID,
      });
      const signature = await provider.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      });
      if (typeof signature !== 'string') throw new Error('The wallet did not return a signature.');

      await verifyWalletChallenge({
        challengeId: challenge.challengeId,
        address,
        message: challenge.message,
        signature,
      });
      setOverview(await getWalletOverview());
      setNotice('Wallet linked and balance checked from Injective Testnet.');
    } catch (linkError) {
      setError(walletErrorMessage(linkError));
    } finally {
      setBusy(false);
    }
  }

  async function refreshOverview() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setOverview(await getWalletOverview());
      setNotice('Balance refreshed from Injective Testnet.');
    } catch (refreshError) {
      setError(walletErrorMessage(refreshError));
    } finally {
      setBusy(false);
    }
  }

  async function unlinkWallet() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteWalletBinding();
      setOverview(null);
      setNotice('Wallet unlinked from this Arena identity.');
    } catch (unlinkError) {
      setError(walletErrorMessage(unlinkError));
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(overview?.address || 'Wallet binding pending');
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const assets = overview
    ? [
        {
          symbol: overview.native.symbol,
          name: 'Native balance',
          detail: 'Gas and network settlement',
          balance: overview.native.balance,
        },
        ...overview.tokens.map((token) => ({
          symbol: token.symbol.replace('arena402-', '402-').toUpperCase(),
          name: token.symbol,
          detail: token.contract,
          balance: token.balance,
        })),
      ]
    : [
        { symbol: 'INJ', name: 'Native balance', detail: 'Gas and network settlement', balance: '—' },
        { symbol: '402-G', name: 'arena402-g', detail: 'Game trading capital', balance: '—' },
        { symbol: '402-M', name: 'arena402-m', detail: 'Soulbound participation mark', balance: '—' },
      ];

  return (
    <div className="wallet-page site-main">
      <section className="wallet-hero">
        <div className="wallet-hero-copy">
          <Link className="back-btn" href="/">
            ← The Arena gate
          </Link>
          <p className="label">Treasury / Public chain / Player custody</p>
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
          {(error || notice) && (
            <p className={`wallet-feedback ${error ? 'wallet-feedback-error' : ''}`} role={error ? 'alert' : 'status'}>
              {error || notice}
            </p>
          )}
        </div>

        <aside className="wallet-seal-card" aria-labelledby="wallet-seal-title">
          <div className="wallet-seal-orbit wallet-seal-orbit-one" aria-hidden="true" />
          <div className="wallet-seal-orbit wallet-seal-orbit-two" aria-hidden="true" />
          <div className="wallet-seal-card-top">
            <span className="label">Wallet seal</span>
            <span className="wallet-seal-mark" aria-hidden="true">402</span>
          </div>
          <p className="wallet-seal-state">{overview ? 'LINKED' : 'NOT LINKED'}</p>
          <h2 id="wallet-seal-title">
            {overview ? `${overview.address.slice(0, 6)}…${overview.address.slice(-4)}` : 'No address has claimed this treasury.'}
          </h2>
          <p>
            {overview
              ? `Verified ${formatDate(overview.checkedAt)} on ${overview.network}.`
              : 'Link a player-owned Injective EVM address before Arena can read balances or associate settlement receipts with this identity.'}
          </p>
          <div className="wallet-seal-actions">
            {session ? (
              overview ? (
                <>
                  <button type="button" className="btn" onClick={() => void refreshOverview()} disabled={busy}>
                    {busy ? 'Checking…' : 'Refresh balance'}
                  </button>
                  <button type="button" className="wallet-copy-action" onClick={() => void unlinkWallet()} disabled={busy}>
                    Unlink wallet
                  </button>
                </>
              ) : (
                <button type="button" className="btn" onClick={() => void linkWallet()} disabled={busy}>
                  {busy ? 'Waiting for wallet…' : 'Link wallet'} <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              )
            ) : (
              <Link className="btn" href="/signin?return_to=%2Fwallet">
                Sign in to continue <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
            <button type="button" className="wallet-copy-action" onClick={() => void copyAddress()}>
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy address'}
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
            {overview
              ? `Checked ${formatDate(overview.checkedAt)}. Read-only chain data; no transaction was submitted.`
              : 'Read-only until a wallet is linked. Arena never treats an unverified address as a player identity.'}
          </p>
        </div>
        <div className="wallet-asset-grid">
          {assets.map((asset) => (
            <article className="wallet-asset-card" key={asset.name}>
              <div className="wallet-asset-mark">{asset.symbol}</div>
              <div>
                <p className="label">{asset.name}</p>
                <h3>{asset.balance}</h3>
                <p className="wallet-asset-detail">{asset.detail}</p>
              </div>
              <span className="wallet-asset-state">{overview ? 'Server verified' : 'Wallet not linked'}</span>
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
            The server checks the chain before displaying the balance. Wallet keys never enter Arena.
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
