'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getConnectorAuthSession } from '@/lib/connector-api';

export default function SignedInRedirect({
  returnTo = '/play',
}: {
  returnTo?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getConnectorAuthSession()
      .then((session) => {
        if (!cancelled && session) router.replace(returnTo);
      })
      .catch(() => {
        // The sign-in page remains usable when the API is temporarily offline.
      });
    return () => {
      cancelled = true;
    };
  }, [returnTo, router]);

  return null;
}
