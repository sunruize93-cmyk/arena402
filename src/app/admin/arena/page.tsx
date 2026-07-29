import type { Metadata } from 'next';
import '../../arena402-admin.css';
import AdminArenaDashboard from '@/components/AdminArenaDashboard';

export const metadata: Metadata = {
  title: 'Arena Control Preview',
  description: 'Non-authoritative Arena 402 administration interface preview.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArenaAdminPage() {
  return <AdminArenaDashboard />;
}
