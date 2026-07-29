import WalletSurface from '@/components/WalletSurface';
import '../arena402-wallet.css';

export const metadata = {
  title: 'Treasury',
  description: 'Inspect the wallet and on-chain treasury attached to Arena 402.',
};

export default function WalletPage() {
  return <WalletSurface />;
}
