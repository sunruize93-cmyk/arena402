'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, Copy, ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  ConnectorAuthSession,
  getConnectorAuthSession,
} from '@/lib/connector-api';
import {
  ExternalWallet,
  WalletApiError,
  MyWallet,
  WalletOverview,
  createExternalWalletChallenge,
  disconnectExternalWallet,
  getExternalWallet,
  getMyWallet,
  getWalletOverview,
  verifyExternalWallet,
} from '@/lib/wallet-api';

const INJECTIVE_TESTNET_CHAIN_ID = 1439;
const INJECTIVE_TESTNET_CHAIN_HEX = '0x59f';

interface EthereumProvider {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
}

const NETWORK_FACTS = [
  ['Network', 'Injective EVM testnet'],
  ['Chain ID', '1439'],
  ['Settlement', 'x402 / EIP-3009'],
  ['Explorer', 'Testnet Blockscout'],
] as const;

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
      wallet_pool_exhausted: 'The treasury has no available wallets right now. Contact the Arena crew.',
      github_identity_required: 'A GitHub-verified Arena identity is required before a wallet can be assigned.',
      github_identity_conflict: 'This Arena identity does not match its recorded GitHub subject. Contact the Arena crew.',
      wallet_binding_conflict: 'The treasury hit a binding conflict. Retry in a moment.',
      wallet_payload_invalid: 'The treasury returned an unexpected wallet payload.',
      wallet_overview_unavailable: 'Balance reads are not configured yet. The assigned address is still valid.',
      wallet_already_bound: 'This Arena account is already linked to another wallet. Disconnect it first.',
      wallet_address_already_bound: 'This wallet is already linked to another Arena account.',
      wallet_challenge_expired: 'The wallet signature request expired. Please connect again.',
      wallet_signature_invalid: 'The wallet signature could not be verified.',
      wallet_signature_address_mismatch: 'The signed wallet does not match the selected account.',
      unsupported_wallet_chain: 'Switch your wallet to Injective EVM Testnet and retry.',
      network_unavailable: 'The Arena API is unreachable. Check the local backend and retry.',
    };
    return messages[error.code] || error.message;
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    Reflect.get(error, 'code') === 4001
  ) {
    return 'The wallet request was cancelled.';
  }
  return error instanceof Error ? error.message : 'The treasury check failed. Please retry.';
}

function browserWallet(): EthereumProvider | null {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum || null;
}

async function useInjectiveTestnet(provider: EthereumProvider): Promise<void> {
  const current = await provider.request({ method: 'eth_chainId' });
  if (current === INJECTIVE_TESTNET_CHAIN_HEX) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: INJECTIVE_TESTNET_CHAIN_HEX }],
    });
  } catch (error) {
    if (!error || typeof error !== 'object' || Reflect.get(error, 'code') !== 4902) {
      throw error;
    }
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: INJECTIVE_TESTNET_CHAIN_HEX,
          chainName: 'Injective EVM Testnet',
          nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
          rpcUrls: ['https://k8s.testnet.json-rpc.injective.network/'],
          blockExplorerUrls: ['https://testnet.blockscout.injective.network'],
        },
      ],
    });
  }

  const selected = await provider.request({ method: 'eth_chainId' });
  if (selected !== INJECTIVE_TESTNET_CHAIN_HEX) {
    throw new Error('Select Injective EVM Testnet in your wallet and retry.');
  }
}

export default function WalletSurface() {
  const [session, setSession] = useState<ConnectorAuthSession | null>(null);
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [externalWallet, setExternalWallet] = useState<ExternalWallet | null>(null);
  const [overview, setOverview] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [externalBusy, setExternalBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  // GET /api/v1/me/wallet lazily claims an inventory wallet on the first
  // authenticated call, so a plain read is the whole "binding" flow. A 404
  // only happens while the backend route is not deployed yet.
  const loadTreasury = useCallback(async () => {
    let assigned: MyWallet | null = null;
    try {
      assigned = await getMyWallet();
    } catch (walletError) {
      if (walletError instanceof WalletApiError && walletError.status === 404) {
        return { wallet: null, overview: null };
      }
      throw walletError;
    }

    // Balances are an enhancement; the assignment still renders without them.
    let balances: WalletOverview | null = null;
    try {
      balances = await getWalletOverview();
    } catch (overviewError) {
      if (!(overviewError instanceof WalletApiError)) throw overviewError;
    }
    return { wallet: assigned, overview: balances };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      try {
        const value = await getConnectorAuthSession();
        if (cancelled) return;
        setSession(value);
        if (!value) return;

        const [treasuryResult, externalResult] = await Promise.allSettled([
          loadTreasury(),
          getExternalWallet(),
        ]);
        if (cancelled) return;
        if (treasuryResult.status === 'fulfilled') {
          setWallet(treasuryResult.value.wallet);
          setOverview(treasuryResult.value.overview);
        } else {
          setError(walletErrorMessage(treasuryResult.reason));
        }
        if (externalResult.status === 'fulfilled') {
          setExternalWallet(externalResult.value);
        } else if (
          !(externalResult.reason instanceof WalletApiError) ||
          externalResult.reason.status !== 404
        ) {
          setError(walletErrorMessage(externalResult.reason));
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
  }, [loadTreasury]);

  async function checkAssignment() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const treasury = await loadTreasury();
      setWallet(treasury.wallet);
      setOverview(treasury.overview);
      setNotice(
        treasury.wallet
          ? 'Treasury wallet assigned to this Arena identity.'
          : 'No treasury wallet has been assigned yet. Check again after registration completes.',
      );
    } catch (checkError) {
      setError(walletErrorMessage(checkError));
    } finally {
      setBusy(false);
    }
  }

  async function connectExternalWallet() {
    setExternalBusy(true);
    setError('');
    setNotice('');
    try {
      const provider = browserWallet();
      if (!provider) {
        throw new Error('Open an Injective EVM-compatible browser wallet and retry.');
      }
      await useInjectiveTestnet(provider);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        throw new Error('The wallet did not return a valid EVM address.');
      }
      const challenge = await createExternalWalletChallenge(
        address,
        INJECTIVE_TESTNET_CHAIN_ID,
      );
      const signature = await provider.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      });
      if (typeof signature !== 'string') {
        throw new Error('The wallet did not return a signature.');
      }
      const binding = await verifyExternalWallet({
        challengeId: challenge.challengeId,
        address,
        message: challenge.message,
        signature,
      });
      setExternalWallet(binding);
      setNotice('Your wallet is verified and linked to this Arena identity.');
    } catch (connectError) {
      setError(walletErrorMessage(connectError));
    } finally {
      setExternalBusy(false);
    }
  }

  async function disconnectUserWallet() {
    setExternalBusy(true);
    setError('');
    setNotice('');
    try {
      await disconnectExternalWallet();
      setExternalWallet(null);
      setNotice('Your user-controlled wallet has been disconnected.');
    } catch (disconnectError) {
      setError(walletErrorMessage(disconnectError));
    } finally {
      setExternalBusy(false);
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
      if (
        refreshError instanceof WalletApiError &&
        (refreshError.status === 404 || refreshError.code === 'wallet_overview_unavailable')
      ) {
        setNotice('Balance reads are not available yet. The assigned address is still valid.');
      } else {
        setError(walletErrorMessage(refreshError));
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!navigator.clipboard || !wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
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
            <span>{session ? 'Arena session found' : 'Sign in to view your treasury wallet'}</span>
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
          <p className="wallet-seal-state">{wallet ? 'ASSIGNED' : 'NOT ASSIGNED'}</p>
          <h2 id="wallet-seal-title">
            {wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'No treasury wallet has been assigned yet.'}
          </h2>
          <p>
            {wallet
              ? overview
                ? `Verified ${formatDate(overview.checkedAt)} on ${overview.network}.`
                : `Assigned wallet ${wallet.walletId} on chain ${wallet.chainId}${wallet.boundAt ? ` · ${formatDate(wallet.boundAt)}` : ''}.`
              : 'The Arena treasury custodies an Injective EVM wallet for every registered player. Yours appears here once registration completes.'}
          </p>
          <div className="wallet-seal-actions">
            {session ? (
              wallet ? (
                <button type="button" className="btn" onClick={() => void refreshOverview()} disabled={busy}>
                  {busy ? 'Checking…' : 'Refresh balance'}
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => void checkAssignment()} disabled={busy}>
                  {busy ? 'Checking…' : 'Check assignment'} <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              )
            ) : (
              <Link className="btn" href="/signin?return_to=%2Fwallet">
                Sign in to continue <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            )}
            {wallet && (
              <button type="button" className="wallet-copy-action" onClick={() => void copyAddress()}>
                {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy address'}
              </button>
            )}
          </div>
        </aside>
      </section>

      <section className="wallet-section wallet-external" aria-labelledby="external-wallet-title">
        <div className="wallet-section-heading">
          <div>
            <p className="label">Your wallet</p>
            <h2 className="display" id="external-wallet-title">Prove the key is yours.</h2>
          </div>
          <p className="wallet-section-note">
            Connect an Injective EVM wallet and sign one ownership message. The signature
            does not authorize a transaction, payment, or Agent action.
          </p>
        </div>
        <div className="wallet-external-card">
          <div className="wallet-external-copy">
            <span className="wallet-external-icon" aria-hidden="true">
              <Wallet size={22} strokeWidth={1.2} />
            </span>
            <div>
              <p className="label">Injective EVM Testnet</p>
              <h3>
                {externalWallet
                  ? `${externalWallet.address.slice(0, 8)}…${externalWallet.address.slice(-6)}`
                  : 'Connect your browser wallet.'}
              </h3>
              <p>
                {externalWallet
                  ? `Verified ${formatDate(externalWallet.verifiedAt)} on chain ${externalWallet.chainId}.`
                  : 'Only Injective EVM Testnet is accepted. Arena stores only the verified public address.'}
              </p>
            </div>
          </div>
          <div className="wallet-external-actions">
            {!session ? (
              <Link className="btn" href="/signin?return_to=%2Fwallet">
                Sign in first <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            ) : externalWallet ? (
              <button
                type="button"
                className="wallet-copy-action"
                disabled={externalBusy}
                onClick={() => void disconnectUserWallet()}
              >
                {externalBusy ? 'Disconnecting…' : 'Disconnect wallet'}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={externalBusy}
                onClick={() => void connectExternalWallet()}
              >
                {externalBusy ? 'Waiting for wallet…' : 'Connect Injective wallet'}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
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
              : wallet
                ? 'Balance reads are pending. The assigned address is already reserved for this identity.'
                : 'Read-only until the treasury assigns a wallet. Arena never treats an unverified address as a player identity.'}
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
              <span className="wallet-asset-state">
                {overview ? 'Server verified' : wallet ? 'Awaiting chain read' : 'Wallet not assigned'}
              </span>
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
            The server checks the chain before displaying the balance. Wallet keys stay in the Arena treasury and never reach the browser.
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
        <div><span>01</span><strong>Arena custody</strong><p>The treasury holds and signs for every player wallet.</p></div>
        <div><span>02</span><strong>Server verification</strong><p>Balances are read from the chain, never from a database ledger.</p></div>
        <div><span>03</span><strong>Public receipts</strong><p>Settlement is only final after the chain confirms it.</p></div>
      </section>
    </div>
  );
}
