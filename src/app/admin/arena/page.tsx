import type { Metadata } from 'next';
import AdminArenaDashboard from '@/components/AdminArenaDashboard';

export const metadata: Metadata = {
  title: 'Arena Control',
  description: 'Administrative operations console for Arena 402.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArenaAdminPage() {
  return <AdminArenaDashboard />;
}
