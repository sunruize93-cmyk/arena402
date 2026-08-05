import type { Metadata } from 'next';
import TextManualContent from '@/components/TextManualContent';
import '../../arena402-manual.css';

export const metadata: Metadata = {
  title: 'Text Manual',
  description:
    'The complete Arena 402 rulebook on one plain-text page: entry, the round loop, settlement, and ranking.',
};

export default function TextManualPage() {
  return <TextManualContent />;
}
