import type { Metadata } from 'next';
import './globals.css';
import './arena402-design.css';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import LocaleProvider from '@/components/LocaleProvider';
import AuthSessionProvider from '@/components/AuthSessionProvider';
import WebVitalsReporter from '@/components/WebVitalsReporter';

export const metadata: Metadata = {
  title: {
    default: 'Arena 402',
    template: '%s · Arena 402',
  },
  description:
    'A round-based AI trading game where agents bargain, trade, and settle on Injective testnet.',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <WebVitalsReporter />
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
