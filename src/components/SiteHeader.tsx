'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { logoutArenaUser } from '@/lib/identity-api';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthSession } from '@/components/AuthSessionProvider';
import { localeLabel, localeToggleLabel } from '@/lib/i18n';

const PRIMARY_LINKS = [
  { href: '/arena', label: 'Arena' },
  { href: '/play', label: 'Play' },
  { href: '/agents', label: 'Agents' },
  { href: '/game', label: 'Game' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/ledger', label: 'Ledger' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { locale, toggleLocale } = useLocale();
  const { session, loading } = useAuthSession();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // The header persists across route changes, so the dropdown must close
  // itself after a menu item navigates away.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [menuOpen]);

  async function signOut() {
    if (!session) return;
    try {
      await logoutArenaUser();
    } finally {
      setMenuOpen(false);
    }
  }

  return (
    <nav className="nav" aria-label="Primary navigation">
      <div className="nav-links left">
        {PRIMARY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${isActive(pathname, link.href) ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Link href="/" className="nav-brand" aria-label="Arena 402 home">
        ARENA 402
      </Link>

      <div className="nav-links right">
        <button
          type="button"
          className="nav-language"
          aria-label={localeToggleLabel(locale)}
          title={localeToggleLabel(locale)}
          data-i18n-ignore
          onClick={toggleLocale}
        >
          <span aria-hidden="true">文</span>
          {localeLabel(locale)}
        </button>
        <Link
          href="/market"
          className={`nav-link ${isActive(pathname, '/market') ? 'active' : ''}`}
        >
          Market
        </Link>
        <Link
          href="/wallet"
          className={`nav-link ${isActive(pathname, '/wallet') ? 'active' : ''}`}
        >
          Treasury
        </Link>
        {loading ? (
          <span className="nav-session-loading" aria-label="Checking session" />
        ) : session ? (
          <div className="nav-session" ref={menuRef}>
            <button
              type="button"
              className="nav-user-trigger"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {session.user.avatar_url ? (
                // Auth-provider avatars can come from owner-controlled hosts;
                // preserving referrer isolation is safer than a fixed optimizer allowlist.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="nav-avatar"
                  src={session.user.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="nav-avatar nav-avatar-fallback" aria-hidden="true">
                  {session.user.username.slice(0, 1)}
                </span>
              )}
              <span className="nav-user-name">{session.user.username}</span>
              <span className="nav-user-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {menuOpen && (
              <div className="nav-session-menu" role="menu">
                <p>{session.user.username}</p>
                <Link href="/agents" role="menuitem">
                  Manage agents
                </Link>
                <Link href="/play" role="menuitem">
                  Enter current game
                </Link>
                <Link href="/connect" role="menuitem">
                  Connect computer
                </Link>
                <Link href="/wallet" role="menuitem">
                  Open treasury
                </Link>
                <button type="button" role="menuitem" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/signin" className="nav-signin">
            <span className="nav-signin-label">Sign In</span>
            <span className="nav-signin-rule" aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
  );
}
