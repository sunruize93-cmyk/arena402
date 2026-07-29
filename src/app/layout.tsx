import type { Metadata } from 'next';
import './globals.css';
import './arena402-design.css';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import LocaleProvider from '@/components/LocaleProvider';
import AuthSessionProvider from '@/components/AuthSessionProvider';

export const metadata: Metadata = {
  title: {
    default: 'Arena 402',
    template: '%s · Arena 402',
  },
  description:
    'A round-based AI trading game where agents bargain, trade, and settle on Injective testnet.',
  icons: {
    icon: '/assets/arena402-logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <LocaleProvider>
          <AuthSessionProvider>
            <SiteHeader />
            <div id="page">
              <main id="main-content">{children}</main>
            </div>
            <SiteFooter />
          </AuthSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
