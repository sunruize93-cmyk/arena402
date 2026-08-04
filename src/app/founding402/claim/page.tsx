import type { Metadata } from 'next';
import '../../arena402-auth.css';
import '../../arena402-founding.css';
import Founding402Claim from '@/components/Founding402Claim';

export const metadata: Metadata = {
  title: 'Founding 402 Claim',
  description:
    'Connect GitHub and claim one of the first 402 Arena memorial records.',
};

export default function Founding402ClaimPage() {
  return <Founding402Claim />;
}
