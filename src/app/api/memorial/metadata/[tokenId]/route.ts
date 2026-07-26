import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Array.from({ length: 402 }, (_, tokenId) => ({
    tokenId: String(tokenId),
  }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId: rawTokenId } = await context.params;
  if (!/^(0|[1-9][0-9]{0,2})$/.test(rawTokenId)) {
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 });
  }
  const tokenId = Number(rawTokenId);
  if (!Number.isSafeInteger(tokenId) || tokenId < 0 || tokenId >= 402) {
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 });
  }
  return NextResponse.json(
    {
      name: `Arena 402 Founding #${String(tokenId + 1).padStart(3, '0')}`,
      description:
        'A non-transferable memorial record for one of the first 402 durable GitHub registrations in Arena 402.',
      image: 'https://www.arena402.com/assets/arena402-logo.jpg',
      external_url: 'https://www.arena402.com/founding402/claim',
      attributes: [
        { trait_type: 'Founding rank', value: tokenId + 1 },
        { trait_type: 'Edition size', value: 402 },
        { trait_type: 'Network', value: 'Injective EVM Testnet' },
        { trait_type: 'Transferability', value: 'Soulbound' },
      ],
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400',
      },
    },
  );
}
