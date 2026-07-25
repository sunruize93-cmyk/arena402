'use client';

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  ChevronRight,
  CircleGauge,
  Database,
  History,
  LockKeyhole,
  MoreHorizontal,
  Pause,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Tone = 'healthy' | 'attention' | 'muted' | 'blocked' | 'working';

interface ActionIntent {
  action: string;
  target: string;
  detail: string;
  confirmation: string;
  tone?: 'standard' | 'danger';
}

interface ActionMenu {
  title: string;
  target: string;
  actions: ActionIntent[];
}

const NAV_ITEMS = [
  { id: 'overview', index: '01', label: 'Platform' },
  { id: 'wallets', index: '02', label: 'Wallets' },
  { id: 'facilitators', index: '03', label: 'Facilitators' },
  { id: 'mandates', index: '04', label: 'Mandates' },
  { id: 'settlements', index: '05', label: 'Settlement' },
  { id: 'security', index: '06', label: 'Security' },
] as const;

const OVERVIEW_METRICS = [
  { label: 'Platform users', value: '2,184', delta: '+38 / 7D', tone: 'healthy' as Tone },
  { label: 'Bound wallets', value: '1,927', delta: '88.2%', tone: 'healthy' as Tone },
  { label: 'Unbound wallets', value: '257', delta: '11.8%', tone: 'muted' as Tone },
  { label: 'Active game wallets', value: '86', delta: '4 games', tone: 'working' as Tone },
  { label: 'Active mandates', value: '63', delta: '142.8K USDC', tone: 'working' as Tone },
  { label: 'Facilitators healthy', value: '09 / 11', delta: '2 low gas', tone: 'attention' as Tone },
] as const;

const WALLET_ROWS = [
  {
    user: 'rook_runner',
    subject: 'gh:71…a93f',
    address: '0x7A1E91d1423cE02A918b26Ac8108F91E67119B4f',
    bound: '25 Jul 2026 · 14:22',
    status: 'active',
    game: 'G-8F2A · R4',
    balance: '1,284.20 USDC',
    ledger: '19.4 G · 2 W',
    mandate: 'active · 440 / 1,200',
    tx: '0x2c1f…8b09',
  },
  {
    user: 'bishop_protocol',
    subject: 'gh:29…0e41',
    address: '0x31b72E8a99046872b941F2f62a7611C5850e6F20',
    bound: '23 Jul 2026 · 09:08',
    status: 'ready',
    game: '—',
    balance: '706.00 USDC',
    ledger: '—',
    mandate: 'expired',
    tx: '0x04d8…21ec',
  },
  {
    user: 'knightshift',
    subject: 'gh:b4…77c2',
    address: '0x92f7716a66D167dE729406408B1398f520e2F8A4',
    bound: '21 Jul 2026 · 18:41',
    status: 'quarantined',
    game: 'G-A90C · PAUSED',
    balance: '98.14 USDC',
    ledger: '8.2 G · 0 W',
    mandate: 'reserve paused',
    tx: '0xb191…774a',
  },
  {
    user: 'endgame_lab',
    subject: 'gh:18…c90d',
    address: '—',
    bound: 'Not bound',
    status: 'unbound',
    game: '—',
    balance: '—',
    ledger: '—',
    mandate: '—',
    tx: '—',
  },
  {
    user: 'pawnstar_402',
    subject: 'gh:95…78ee',
    address: '0xE0d802Fbd0b4c248d7E8149856b40Fe4A2d41870',
    bound: '18 Jul 2026 · 07:12',
    status: 'disabled',
    game: '—',
    balance: '0.08 USDC',
    ledger: '—',
    mandate: 'revoked',
    tx: '0xd4aa…6fd2',
  },
] as const;

const FACILITATORS = [
  ['F-01', '0x4b8219D4716bc0c7E72449c470D649431633bf51', 'healthy', '4.82 INJ', '08', '4,281', '12', '12,941', '14:31:09'],
  ['F-02', '0xA760099d5364d55C3aD6Cc6D3d2D37d07974b12e', 'healthy', '3.76 INJ', '06', '3,914', '09', '12,204', '14:30:42'],
  ['F-03', '0x4E0227E7F5f155E20b09127274517075BF61D57B', 'healthy', '2.91 INJ', '07', '3,882', '11', '11,870', '14:30:11'],
  ['F-04', '0xB4A94a37b553124A150d00C6BDfF07067B0aEa3C', 'low gas', '0.18 INJ', '00', '3,010', '18', '10,992', '14:18:07'],
  ['F-05', '0x2358b154B72D55f8e4A03eb65539b350e6750102', 'healthy', '4.21 INJ', '09', '4,044', '06', '13,120', '14:31:15'],
  ['F-06', '0x53b46Bf0Eca1Dfc132ebFB81D4056eC75E18A9B1', 'healthy', '2.38 INJ', '05', '3,742', '10', '12,808', '14:29:58'],
  ['F-07', '0x7c0C41b9B7D164d077624e2A4dFeAF58D15d5D5D', 'healthy', '3.08 INJ', '07', '3,620', '07', '12,107', '14:29:47'],
  ['F-08', '0x119BA0B47B0783A3F9441De1311a02a21E0d906A', 'healthy', '1.91 INJ', '06', '3,418', '08', '11,572', '14:29:03'],
  ['F-09', '0xE4B29c89D243F58796888294Bbe813CAAFebDC18', 'healthy', '2.74 INJ', '04', '3,208', '05', '10,882', '14:28:51'],
  ['F-10', '0xf1c5891F806546C2cDFA8be762645Eb006239e23', 'healthy', '3.54 INJ', '05', '3,091', '04', '10,134', '14:28:18'],
  ['F-11', '0x198c86e59Bca86A9DEAF1b0287FE46f234308667', 'quarantined', '0.11 INJ', '00', '2,844', '31', '9,771', '13:52:46'],
] as const;

const MANDATES = [
  {
    id: 'PM-6D91',
    user: 'rook_runner',
    wallet: '0x7A1E…9B4f',
    game: 'G-8F2A',
    asset: 'USDC · INJ EVM 1439',
    single: '250.00',
    total: '1,200.00',
    reserved: '180.00',
    consumed: '440.00',
    available: '580.00',
    window: '14:02 → 16:02 UTC',
    state: 'active',
    reservations: '02',
  },
  {
    id: 'PM-A720',
    user: 'crownless_ai',
    wallet: '0xDe18…a711',
    game: 'G-8F2A',
    asset: 'USDC · INJ EVM 1439',
    single: '180.00',
    total: '900.00',
    reserved: '0.00',
    consumed: '360.00',
    available: '540.00',
    window: '14:02 → 16:02 UTC',
    state: 'active',
    reservations: '00',
  },
  {
    id: 'PM-20C8',
    user: 'knightshift',
    wallet: '0x92f7…F8A4',
    game: 'G-A90C',
    asset: 'USDC · INJ EVM 1439',
    single: '90.00',
    total: '600.00',
    reserved: '90.00',
    consumed: '180.00',
    available: '330.00',
    window: '13:41 → 15:41 UTC',
    state: 'reserve paused',
    reservations: '01',
  },
  {
    id: 'PM-B118',
    user: 'pawnstar_402',
    wallet: '0xE0d8…1870',
    game: 'G-7B10',
    asset: 'USDC · INJ EVM 1439',
    single: '100.00',
    total: '500.00',
    reserved: '0.00',
    consumed: '0.00',
    available: '0.00',
    window: '09:12 → 11:12 UTC',
    state: 'revoked',
    reservations: '00',
  },
] as const;

const SETTLEMENT_STAGES = [
  'authorization_requested',
  'mandate_reserved',
  'signed',
  'submitting',
  'submitted',
  'confirming',
  'confirmed',
  'inventory_committed',
] as const;

const SETTLEMENTS = [
  {
    id: 'SI-20260725-08F2-0441',
    buyer: '0x7A1E…9B4f',
    seller: '0xDe18…a711',
    amount: '180.00 USDC',
    facilitator: 'F-05',
    state: 'confirming',
    tx: '0x2c1f…8b09',
    retries: '0',
    error: '—',
    progress: 5,
  },
  {
    id: 'SI-20260725-08F2-0440',
    buyer: '0x4c00…190A',
    seller: '0x7A1E…9B4f',
    amount: '125.00 USDC',
    facilitator: 'F-01',
    state: 'inventory_committed',
    tx: '0x6d7e…f101',
    retries: '0',
    error: '—',
    progress: 8,
  },
  {
    id: 'SI-20260725-A90C-0188',
    buyer: '0x92f7…F8A4',
    seller: '0x0B71…B193',
    amount: '90.00 USDC',
    facilitator: 'F-04',
    state: 'recovery_required',
    tx: '0xb191…774a',
    retries: '2',
    error: 'CHAIN_RECEIPT_TIMEOUT',
    progress: 6,
  },
  {
    id: 'SI-20260725-C041-0102',
    buyer: '0x481e…772B',
    seller: '0x21A9…A20e',
    amount: '72.00 USDC',
    facilitator: 'F-03',
    state: 'mandate_reserved',
    tx: '—',
    retries: '0',
    error: '—',
    progress: 2,
  },
  {
    id: 'SI-20260725-7B10-0091',
    buyer: '0xE0d8…1870',
    seller: '0x6B4a…7771',
    amount: '100.00 USDC',
    facilitator: 'F-11',
    state: 'quarantined',
    tx: '0xd4aa…6fd2',
    retries: '1',
    error: 'NONCE_STATE_MISMATCH',
    progress: 4,
  },
] as const;

const RECENT_AUDIT = [
  ['14:18:11', 'facilitator.schedule.remove', 'F-04', 'gh:ad…19c1', 'evt_8fc1'],
  ['14:02:48', 'mandate.reserve.pause', 'PM-20C8', 'gh:ad…19c1', 'evt_8f8e'],
  ['13:54:07', 'wallet.quarantine', '0x92f7…F8A4', 'gh:07…e119', 'evt_8e72'],
  ['13:51:39', 'settlement.recover', 'SI-…-0188', 'gh:ad…19c1', 'evt_8e31'],
] as const;

function statusTone(status: string): Tone {
  if (['healthy', 'active', 'ready', 'confirmed', 'inventory_committed'].includes(status)) {
    return 'healthy';
  }
  if (['quarantined', 'disabled', 'revoked', 'reverted'].includes(status)) {
    return 'blocked';
  }
  if (['low gas', 'recovery_required', 'reserve paused'].includes(status)) {
    return 'attention';
  }
  if (['confirming', 'submitting', 'submitted', 'mandate_reserved', 'signed'].includes(status)) {
    return 'working';
  }
  return 'muted';
}

function StatusPill({ children, tone }: { children: string; tone?: Tone }) {
  return (
    <span className={`admin-status is-${tone || statusTone(children)}`}>
      <i aria-hidden="true" />
      {children.replaceAll('_', ' ')}
    </span>
  );
}

function TxLink({ hash }: { hash: string }) {
  if (hash === '—') return <span className="admin-dim">—</span>;
  const href = `https://testnet.blockscout.injective.network/tx/${hash.replace('…', '')}`;
  return (
    <a className="admin-link" href={href} target="_blank" rel="noreferrer">
      {hash}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

export default function AdminArenaDashboard() {
  const [walletQuery, setWalletQuery] = useState('');
  const [walletFilter, setWalletFilter] = useState('all');
  const [intent, setIntent] = useState<ActionIntent | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');

  const filteredWallets = useMemo(() => {
    const normalizedQuery = walletQuery.trim().toLowerCase();
    return WALLET_ROWS.filter((wallet) => {
      const matchesFilter = walletFilter === 'all' || wallet.status === walletFilter;
      const matchesQuery =
        !normalizedQuery ||
        [wallet.user, wallet.subject, wallet.address, wallet.game].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      return matchesFilter && matchesQuery;
    });
  }, [walletFilter, walletQuery]);

  useEffect(() => {
    if (!intent && !actionMenu) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIntent(null);
        setActionMenu(null);
        setReason('');
      }
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [actionMenu, intent]);

  function openIntent(nextIntent: ActionIntent) {
    setActionMenu(null);
    setReason('');
    setNotice('');
    setIntent(nextIntent);
  }

  function closeIntent() {
    setIntent(null);
    setReason('');
  }

  function submitPreview() {
    if (!intent || !reason.trim()) return;
    setNotice(
      `${intent.action} prepared for ${intent.target}. Preview mode sent no API request.`,
    );
    closeIntent();
  }

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <a className="admin-wordmark" href="#overview" aria-label="Arena Control home">
          <span>Arena 402</span>
          <i aria-hidden="true" />
          <small>Control</small>
        </a>
        <div className="admin-topbar-state">
          <span className="admin-environment"><i /> Injective EVM Testnet · 1439</span>
          <span>Snapshot 14:31:18 UTC</span>
          <span className="admin-operator"><ShieldCheck /> gh:ad…19c1</span>
        </div>
      </header>

      <div className="admin-frame">
        <aside className="admin-rail">
          <p className="label">Operations index</p>
          <nav aria-label="Arena administration sections">
            {NAV_ITEMS.map((item) => (
              <a href={`#${item.id}`} key={item.id}>
                <span>{item.index}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="admin-rail-foot">
            <LockKeyhole aria-hidden="true" />
            <p>Server-authorized</p>
            <small>Session · CSRF · Audit</small>
          </div>
        </aside>

        <div className="admin-main">
          <section className="admin-hero" id="overview">
            <div>
              <p className="label">Restricted operations surface · Preview data</p>
              <h1 className="display">Arena<br /><em>Control</em></h1>
            </div>
            <div className="admin-hero-copy">
              <p>
                Wallet custody, mandate exposure, facilitator readiness, and
                deterministic settlement recovery in one auditable field of view.
              </p>
              <div className="admin-safety-line">
                <ShieldCheck aria-hidden="true" />
                <span>No private key, seed phrase, raw CSV, or secret handle is rendered.</span>
              </div>
            </div>
          </section>

          <section className="admin-section admin-overview" aria-labelledby="overview-title">
            <div className="admin-section-head">
              <div>
                <p className="label">01 · Platform overview</p>
                <h2 id="overview-title">Operating position</h2>
              </div>
              <span className="admin-live-mark"><Radio aria-hidden="true" /> live read model</span>
            </div>

            <div className="admin-metric-grid">
              {OVERVIEW_METRICS.map((metric) => (
                <article className="admin-metric" key={metric.label}>
                  <div className="admin-metric-top">
                    <span>{metric.label}</span>
                    <i className={`is-${metric.tone}`} aria-hidden="true" />
                  </div>
                  <strong>{metric.value}</strong>
                  <small>{metric.delta}</small>
                </article>
              ))}
            </div>

            <div className="admin-health-board">
              <article className="admin-health-primary">
                <div>
                  <p className="label">Recent on-chain success</p>
                  <strong>99.42<small>%</small></strong>
                </div>
                <div className="admin-spark" aria-label="Success rate remained above 99 percent">
                  {[74, 88, 82, 94, 89, 92, 96, 86, 95, 98, 94, 99].map((height, index) => (
                    <i style={{ height: `${height}%` }} key={`${height}-${index}`} />
                  ))}
                </div>
                <p>1,204 confirmed / 7 failed · rolling 24h</p>
              </article>
              <article className="admin-health-stat">
                <p className="label">Confirmation latency</p>
                <strong>3.8s</strong>
                <span>P50</span>
                <small>P95 11.4s</small>
              </article>
              <article className="admin-health-stat">
                <p className="label">Settlement queue</p>
                <strong>19</strong>
                <span>in flight</span>
                <small>8 pending · 9 confirming · 2 recovery</small>
              </article>
              <article className="admin-health-action">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>2 operator reviews</strong>
                  <p>Recovery uses the original deterministic authorization.</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </article>
            </div>
          </section>

          <section className="admin-section" id="wallets" aria-labelledby="wallets-title">
            <div className="admin-section-head">
              <div>
                <p className="label">02 · Users & wallets</p>
                <h2 id="wallets-title">Permanent bindings</h2>
                <p className="admin-section-note">
                  Rotation preserves historical addresses, ownership, and audit history.
                  Ordinary unbind is intentionally unavailable.
                </p>
              </div>
              <button
                className="admin-outline-button"
                type="button"
                onClick={() =>
                  openIntent({
                    action: 'Run public wallet checks',
                    target: 'filtered wallet set',
                    detail: 'Refreshes public token balances and allowlist eligibility only.',
                    confirmation: 'RUN CHECKS',
                  })
                }
              >
                <RefreshCw aria-hidden="true" /> Run public checks
              </button>
            </div>

            <div className="admin-toolbar">
              <label className="admin-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search wallets</span>
                <input
                  value={walletQuery}
                  onChange={(event) => setWalletQuery(event.target.value)}
                  placeholder="Search user / subject / public address / game"
                />
                <kbd>⌘ K</kbd>
              </label>
              <div className="admin-filters" aria-label="Wallet status filter">
                {['all', 'active', 'ready', 'quarantined', 'unbound', 'disabled'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={walletFilter === filter ? 'active' : ''}
                    onClick={() => setWalletFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table admin-wallet-table">
                <thead>
                  <tr>
                    <th>User / immutable subject</th>
                    <th>Permanent wallet</th>
                    <th>Binding</th>
                    <th>Status</th>
                    <th>Current game</th>
                    <th>Public balance</th>
                    <th>Game cash</th>
                    <th>Mandate</th>
                    <th>Latest tx</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWallets.map((wallet) => (
                    <tr key={wallet.subject}>
                      <td>
                        <strong>{wallet.user}</strong>
                        <small>{wallet.subject}</small>
                      </td>
                      <td className="admin-address">{wallet.address}</td>
                      <td>{wallet.bound}</td>
                      <td><StatusPill>{wallet.status}</StatusPill></td>
                      <td>{wallet.game}</td>
                      <td>{wallet.balance}</td>
                      <td>{wallet.ledger}</td>
                      <td>{wallet.mandate}</td>
                      <td><TxLink hash={wallet.tx} /></td>
                      <td>
                        <button
                          className="admin-icon-button"
                          type="button"
                          aria-label={`Manage ${wallet.user}`}
                          onClick={() =>
                            setActionMenu({
                              title: 'Wallet operations',
                              target: `${wallet.user} · ${wallet.address}`,
                              actions: [
                                {
                                  action: 'Pause new wallet transactions',
                                  target: `${wallet.user} · ${wallet.address}`,
                                  detail: 'Prevents new transactions without altering submitted chain activity.',
                                  confirmation: 'PAUSE WALLET',
                                  tone: 'danger',
                                },
                                {
                                  action: 'Restore wallet',
                                  target: `${wallet.user} · ${wallet.address}`,
                                  detail: 'Returns the wallet to ready after server-side policy and balance checks.',
                                  confirmation: 'RESTORE WALLET',
                                },
                                {
                                  action: 'Quarantine suspicious wallet',
                                  target: `${wallet.user} · ${wallet.address}`,
                                  detail: 'Stops scheduling and isolates the binding for operator investigation.',
                                  confirmation: 'QUARANTINE WALLET',
                                  tone: 'danger',
                                },
                                {
                                  action: 'Revoke current game mandate',
                                  target: `${wallet.user} · ${wallet.game}`,
                                  detail: 'Blocks future reserve while preserving already submitted chain activity.',
                                  confirmation: 'REVOKE MANDATE',
                                  tone: 'danger',
                                },
                                {
                                  action: 'Start wallet rotation',
                                  target: `${wallet.user} · ${wallet.address}`,
                                  detail: 'Creates a new wallet for the same owner and preserves every historical address.',
                                  confirmation: 'START ROTATION',
                                },
                                {
                                  action: 'Run public balance and allowlist checks',
                                  target: `${wallet.user} · ${wallet.address}`,
                                  detail: 'Refreshes public balance and policy eligibility without reading custody secrets.',
                                  confirmation: 'RUN CHECKS',
                                },
                              ],
                            })
                          }
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWallets.length === 0 && (
                <p className="admin-empty">No wallet binding matches this view.</p>
              )}
            </div>
          </section>

          <section className="admin-section" id="facilitators" aria-labelledby="facilitators-title">
            <div className="admin-section-head">
              <div>
                <p className="label">03 · Facilitator pool</p>
                <h2 id="facilitators-title">The eleven signers</h2>
                <p className="admin-section-note">
                  Public operational state only. No import, export, or key inspection
                  surface exists here.
                </p>
              </div>
              <div className="admin-head-count">
                <strong>09</strong><span>healthy</span><i /> <strong>02</strong><span>held</span>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table admin-facilitator-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Public address</th>
                    <th>Health</th>
                    <th>INJ gas</th>
                    <th>Assigned</th>
                    <th>Submitted</th>
                    <th>Failed</th>
                    <th>Persisted nonce</th>
                    <th>Last success</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {FACILITATORS.map((facilitator) => (
                    <tr key={facilitator[0]}>
                      <td><strong>{facilitator[0]}</strong></td>
                      <td className="admin-address">{facilitator[1]}</td>
                      <td><StatusPill>{facilitator[2]}</StatusPill></td>
                      <td>{facilitator[3]}</td>
                      <td>{facilitator[4]}</td>
                      <td>{facilitator[5]}</td>
                      <td>{facilitator[6]}</td>
                      <td>{facilitator[7]}</td>
                      <td>{facilitator[8]}</td>
                      <td>
                        <button
                          className="admin-icon-button"
                          type="button"
                          aria-label={`Manage facilitator ${facilitator[0]}`}
                          onClick={() =>
                            setActionMenu({
                              title: 'Facilitator operations',
                              target: `${facilitator[0]} · ${facilitator[1]}`,
                              actions: [
                                {
                                  action: 'Pause facilitator',
                                  target: `${facilitator[0]} · ${facilitator[1]}`,
                                  detail: 'Removes the account from new scheduling. Submitted transactions continue to confirmation.',
                                  confirmation: 'PAUSE FACILITATOR',
                                  tone: 'danger',
                                },
                                {
                                  action: 'Resume facilitator',
                                  target: `${facilitator[0]} · ${facilitator[1]}`,
                                  detail: 'Returns the account to scheduling after server-side health and nonce checks.',
                                  confirmation: 'RESUME FACILITATOR',
                                },
                                {
                                  action: 'Remove low balance from scheduling',
                                  target: `${facilitator[0]} · ${facilitator[3]}`,
                                  detail: 'Holds new assignments until INJ gas returns above policy threshold.',
                                  confirmation: 'REMOVE FROM SCHEDULER',
                                  tone: 'danger',
                                },
                                {
                                  action: 'Run read-only health check',
                                  target: `${facilitator[0]} · ${facilitator[1]}`,
                                  detail: 'Reads public gas, nonce, and chain health without changing scheduler state.',
                                  confirmation: 'RUN HEALTH CHECK',
                                },
                                {
                                  action: 'View submitted public transactions',
                                  target: `${facilitator[0]} · ${facilitator[1]}`,
                                  detail: 'Opens the account-scoped public transaction ledger.',
                                  confirmation: 'OPEN TRANSACTIONS',
                                },
                              ],
                            })
                          }
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section" id="mandates" aria-labelledby="mandates-title">
            <div className="admin-section-head">
              <div>
                <p className="label">04 · PaymentMandate</p>
                <h2 id="mandates-title">Bounded authority</h2>
                <p className="admin-section-note">
                  Revocation blocks future reserve. It never fabricates cancellation
                  of a transaction already submitted on-chain.
                </p>
              </div>
              <div className="admin-head-count">
                <strong>63</strong><span>active</span><i /> <strong>07</strong><span>in-flight reserves</span>
              </div>
            </div>

            <div className="admin-mandate-list">
              {MANDATES.map((mandate) => {
                const spent = Number(mandate.consumed.replace(',', ''));
                const total = Number(mandate.total.replace(',', ''));
                const reserved = Number(mandate.reserved.replace(',', ''));
                return (
                  <article className="admin-mandate" key={mandate.id}>
                    <div className="admin-mandate-id">
                      <span className="label">{mandate.id}</span>
                      <StatusPill>{mandate.state}</StatusPill>
                    </div>
                    <div className="admin-mandate-party">
                      <strong>{mandate.user}</strong>
                      <span>{mandate.wallet}</span>
                      <small>{mandate.game} · {mandate.asset}</small>
                    </div>
                    <dl className="admin-mandate-limits">
                      <div><dt>Single max</dt><dd>{mandate.single}</dd></div>
                      <div><dt>Game max</dt><dd>{mandate.total}</dd></div>
                      <div><dt>Reservations</dt><dd>{mandate.reservations}</dd></div>
                      <div><dt>Window</dt><dd>{mandate.window}</dd></div>
                    </dl>
                    <div className="admin-capacity">
                      <div className="admin-capacity-labels">
                        <span>Consumed {mandate.consumed}</span>
                        <span>Reserved {mandate.reserved}</span>
                        <span>Available {mandate.available}</span>
                      </div>
                      <div className="admin-capacity-track">
                        <i style={{ width: `${(spent / total) * 100}%` }} />
                        <b
                          style={{
                            left: `${(spent / total) * 100}%`,
                            width: `${(reserved / total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <button
                      className="admin-icon-button"
                      type="button"
                      aria-label={`Manage mandate ${mandate.id}`}
                      onClick={() =>
                        setActionMenu({
                          title: 'PaymentMandate operations',
                          target: `${mandate.id} · ${mandate.user}`,
                          actions: [
                            {
                              action: 'Revoke mandate',
                              target: `${mandate.id} · ${mandate.user}`,
                              detail: 'Blocks future reserve without fabricating cancellation of submitted chain activity.',
                              confirmation: 'REVOKE MANDATE',
                              tone: 'danger',
                            },
                            {
                              action: 'Pause new reserve',
                              target: `${mandate.id} · ${mandate.user}`,
                              detail: 'Keeps current reservations valid while preventing new authorization.',
                              confirmation: 'PAUSE RESERVE',
                            },
                            {
                              action: 'View intents and public transactions',
                              target: `${mandate.id} · ${mandate.game}`,
                              detail: 'Opens linked SettlementIntent, reservations, and public transaction records.',
                              confirmation: 'OPEN RECORD',
                            },
                          ],
                        })
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="admin-section" id="settlements" aria-labelledby="settlements-title">
            <div className="admin-section-head">
              <div>
                <p className="label">05 · Automatic settlement</p>
                <h2 id="settlements-title">Deterministic recovery</h2>
                <p className="admin-section-note">
                  Recovery continues the same authorization. A replacement payment
                  with a different nonce is not an available operation.
                </p>
              </div>
              <button
                className="admin-outline-button admin-danger-button"
                type="button"
                onClick={() =>
                  openIntent({
                    action: 'Pause global automatic settlement',
                    target: 'all Arena games',
                    detail:
                      'Stops new settlement progression globally. Submitted transactions remain under observation.',
                    confirmation: 'PAUSE GLOBAL SETTLEMENT',
                    tone: 'danger',
                  })
                }
              >
                <Pause aria-hidden="true" /> Pause globally
              </button>
            </div>

            <div className="admin-settlement-key" aria-label="Settlement state sequence">
              {SETTLEMENT_STAGES.map((stage, index) => (
                <span key={stage}>{String(index + 1).padStart(2, '0')} {stage.replaceAll('_', ' ')}</span>
              ))}
            </div>

            <div className="admin-settlement-list">
              {SETTLEMENTS.map((settlement) => (
                <article className="admin-settlement" key={settlement.id}>
                  <div className="admin-settlement-summary">
                    <div>
                      <span className="label">SettlementIntent</span>
                      <strong>{settlement.id}</strong>
                    </div>
                    <div><span>Buyer</span><strong>{settlement.buyer}</strong></div>
                    <ChevronRight aria-hidden="true" />
                    <div><span>Seller</span><strong>{settlement.seller}</strong></div>
                    <div><span>Fixed amount</span><strong>{settlement.amount}</strong></div>
                    <div><span>Facilitator</span><strong>{settlement.facilitator}</strong></div>
                    <div><span>Retries</span><strong>{settlement.retries}</strong></div>
                    <div><span>Public tx</span><TxLink hash={settlement.tx} /></div>
                    <button
                      className="admin-icon-button"
                      type="button"
                      aria-label={`Manage settlement ${settlement.id}`}
                      onClick={() =>
                        setActionMenu({
                          title: 'Settlement operations',
                          target: settlement.id,
                          actions: [
                            {
                              action: 'Continue deterministic recovery',
                              target: settlement.id,
                              detail: 'Reuses the original signed authorization and persisted nonce.',
                              confirmation: 'CONTINUE RECOVERY',
                              tone: 'danger',
                            },
                            {
                              action: 'Requery on-chain state',
                              target: settlement.id,
                              detail: 'Performs a read-only receipt and confirmation refresh.',
                              confirmation: 'REQUERY CHAIN',
                            },
                            {
                              action: 'Quarantine settlement record',
                              target: settlement.id,
                              detail: 'Stops automated progression and holds the record for operator review.',
                              confirmation: 'QUARANTINE RECORD',
                              tone: 'danger',
                            },
                            {
                              action: 'Pause automatic settlement for game',
                              target: settlement.id.split('-').slice(2, 3).join(''),
                              detail: 'Stops new settlement progression for this game only.',
                              confirmation: 'PAUSE GAME SETTLEMENT',
                              tone: 'danger',
                            },
                          ],
                        })
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </div>
                  <div className="admin-settlement-progress">
                    {SETTLEMENT_STAGES.map((stage, index) => (
                      <i
                        key={stage}
                        className={
                          index < settlement.progress
                            ? 'complete'
                            : index === settlement.progress
                              ? 'current'
                              : ''
                        }
                        title={stage}
                      />
                    ))}
                  </div>
                  <div className="admin-settlement-state">
                    <StatusPill>{settlement.state}</StatusPill>
                    <span>safe error: <strong>{settlement.error}</strong></span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section admin-security" id="security" aria-labelledby="security-title">
            <div className="admin-section-head">
              <div>
                <p className="label">06 · Administrator security</p>
                <h2 id="security-title">Authority stays server-side</h2>
              </div>
            </div>

            <div className="admin-security-grid">
              <article className="admin-security-card">
                <ShieldCheck aria-hidden="true" />
                <span className="label">Identity</span>
                <h3>Immutable GitHub subject</h3>
                <p>
                  Version one reads an environment allowlist. The API resolves the
                  authenticated subject; usernames never grant authority.
                </p>
                <small>Future: database-backed role table</small>
              </article>
              <article className="admin-security-card">
                <LockKeyhole aria-hidden="true" />
                <span className="label">Mutation boundary</span>
                <h3>Session + CSRF + role</h3>
                <p>
                  Every `/api/v1/admin/*` mutation validates all three on the server.
                  A hidden button or route is not access control.
                </p>
                <small>Deny by default</small>
              </article>
              <article className="admin-security-card">
                <History aria-hidden="true" />
                <span className="label">Evidence</span>
                <h3>Admin audit event</h3>
                <p>
                  Pause, restore, revoke, rotate, quarantine, and recovery actions
                  record actor, target, reason, request ID, and outcome.
                </p>
                <small>Append-only operator trail</small>
              </article>
            </div>

            <div className="admin-audit">
              <div className="admin-audit-head">
                <div>
                  <p className="label">Recent admin audit</p>
                  <h3>Operator trail</h3>
                </div>
                <button
                  type="button"
                  className="admin-text-button"
                  onClick={() =>
                    setNotice('Full audit history will be supplied by the protected admin audit API.')
                  }
                >
                  Open full audit <ArrowUpRight aria-hidden="true" />
                </button>
              </div>
              {RECENT_AUDIT.map((event) => (
                <div className="admin-audit-row" key={event[4]}>
                  <span>{event[0]}</span>
                  <strong>{event[1]}</strong>
                  <span>{event[2]}</span>
                  <span>{event[3]}</span>
                  <small>{event[4]}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          <Check aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      {actionMenu && (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setActionMenu(null)}
        >
          <section
            className="admin-dialog admin-action-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-action-menu-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-dialog-head">
              <span className="label">Available operations</span>
              <button type="button" onClick={() => setActionMenu(null)} aria-label="Close dialog">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="admin-dialog-icon">
              <CircleGauge />
            </div>
            <h2 id="admin-action-menu-title">{actionMenu.title}</h2>
            <p className="admin-action-target">{actionMenu.target}</p>
            <div className="admin-action-options">
              {actionMenu.actions.map((action, index) => (
                <button
                  type="button"
                  key={action.action}
                  onClick={() => openIntent(action)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{action.action}</strong>
                    <small>{action.detail}</small>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="admin-dialog-warning">
              <LockKeyhole aria-hidden="true" />
              <span>
                Every mutation requires server-side role validation, the existing
                session and CSRF token, an operator reason, and an admin audit event.
              </span>
            </div>
          </section>
        </div>
      )}

      {intent && (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={closeIntent}>
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-dialog-head">
              <span className="label">Audited mutation preview</span>
              <button type="button" onClick={closeIntent} aria-label="Close dialog">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="admin-dialog-icon">
              {intent.tone === 'danger' ? <AlertTriangle /> : <CircleGauge />}
            </div>
            <h2 id="admin-dialog-title">{intent.action}</h2>
            <p>{intent.detail}</p>
            <dl>
              <div><dt>Target</dt><dd>{intent.target}</dd></div>
              <div><dt>Authorization</dt><dd>Server role · Session · CSRF</dd></div>
              <div><dt>Audit</dt><dd>Required before execution</dd></div>
            </dl>
            <label className="admin-reason">
              <span>Operator reason</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required for the admin audit event…"
                rows={3}
                autoFocus
              />
            </label>
            <div className="admin-dialog-warning">
              <Database aria-hidden="true" />
              <span>
                Frontend preview only. No admin API is connected in this repository,
                so confirming does not change server or chain state.
              </span>
            </div>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-text-button" onClick={closeIntent}>
                Cancel
              </button>
              <button
                type="button"
                className={`admin-confirm-button ${intent.tone === 'danger' ? 'is-danger' : ''}`}
                disabled={!reason.trim()}
                onClick={submitPreview}
              >
                {intent.tone === 'danger' ? <Ban aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                {intent.confirmation}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="admin-corner-mark" aria-hidden="true">
        <Activity />
        <WalletCards />
      </div>
    </div>
  );
}
