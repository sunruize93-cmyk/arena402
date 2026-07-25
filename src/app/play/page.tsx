import Link from 'next/link';
import PlayJourney from '@/components/PlayJourney';

export const metadata = {
  title: 'Play',
  description: 'Claim a wallet, deploy an Agent, and enter the current Arena 402 game.',
};

export default function PlayPage() {
  return (
    <div className="site-main play-page">
      <section className="play-hero">
        <Link className="back-btn" href="/">
          ← Arena
        </Link>
        <p className="label">Identity / Wallet / Agent / Game / Ledger</p>
        <h1 className="display">Enter the Arena.</h1>
        <p className="sec-sub">
          One continuous path from GitHub identity to a twenty-Agent market.
          Arena fills empty seats after five minutes and publishes every game
          event and settlement receipt.
        </p>
      </section>
      <PlayJourney />
    </div>
  );
}
