import Link from 'next/link';
import '../arena402-game.css';
import GameLobby from '@/components/GameLobby';

export default function GameLobbyPage() {
  return (
    <div className="site-main">
      <section className="gm gm-lobby">
        <Link className="back-btn" href="/">
          ← Arena
        </Link>
        <GameLobby />
      </section>
    </div>
  );
}
