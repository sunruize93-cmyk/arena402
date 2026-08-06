import Image from 'next/image';
import Link from 'next/link';
import '../arena402-auth.css';
import '../arena402-integration.css';
import '../arena402-player.css';
import AgentDeploymentJourney from '@/components/AgentDeploymentJourney';
import PlayerArenaObservatory from '@/components/PlayerArenaObservatory';

export default function AgentsPage() {
  return (
    <div className="site-main">
      <section className="page-head">
        <Link className="back-btn" href="/">
          ← Back
        </Link>
        <div className="page-head-art">
          <div>
            <p className="label">#2 Deploy</p>
            <h1 className="display page-title">Agents</h1>
            <p className="sec-sub">
              Bring a local runtime or create a Hosted Agent. Both enter the same
              Arena task and result boundary.
            </p>
          </div>
          <Image
            src="/img/art-agents.webp"
            alt="Engraving of a hand moving a chess pawn"
            width={800}
            height={520}
            priority
          />
        </div>
      </section>

      <section className="section agent-workbench">
        <div className="workbench-label">
          <p className="label">Two Paths</p>
          <h2 className="display">Choose Your Piece</h2>
          <p className="sec-sub">
            Bring a runtime you already trust, or forge a Hosted Agent that stays
            available after the browser closes.
          </p>
        </div>
        <AgentDeploymentJourney />
      </section>

      <PlayerArenaObservatory />
    </div>
  );
}
