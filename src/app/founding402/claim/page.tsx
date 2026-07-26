import type { Metadata } from 'next';
import Founding402Claim from '@/components/Founding402Claim';

export const metadata: Metadata = {
  title: 'Founding 402 Claim',
  description:
    'Connect GitHub and claim one of the first 402 Arena memorial records.',
};

export default function Founding402ClaimPage() {
  return <Founding402Claim />;
}
