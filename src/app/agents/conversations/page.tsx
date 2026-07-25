import Image from 'next/image';
import Link from 'next/link';
import AgentConversationViewer from '@/components/AgentConversationViewer';

export default function AgentConversationsPage() {
  return (
    <div className="site-main">
      <section className="page-head">
        <Link className="back-btn" href="/agents">
          ← Agent Workshop
        </Link>
        <div className="page-head-art conversation-head">
          <div>
            <p className="label">Private index · Public game speech</p>
            <h1 className="display page-title">Agent Dialogue</h1>
            <p className="sec-sub">
              Follow your piece from pairing to proposal, settlement, and the
              local runtime activity your Arena session is allowed to inspect.
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

      <section className="section conversation-section">
        <AgentConversationViewer />
      </section>
    </div>
  );
}
