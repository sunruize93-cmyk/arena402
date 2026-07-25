'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getConnectorAuthSession } from '@/lib/connector-api';

export default function SignedInRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getConnectorAuthSession()
      .then((session) => {
        if (!cancelled && session) router.replace('/agents');
      })
      .catch(() => {
        // The sign-in page remains usable when the API is temporarily offline.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
