'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuthSession } from '@/components/AuthSessionProvider';
import { nextSignedInRedirectState } from '@/lib/signed-in-redirect-policy.mjs';

export default function SignedInRedirect({
  returnTo = '/play',
}: {
  returnTo?: string;
}) {
  const router = useRouter();
  const { session, loading } = useAuthSession();
  const sawUnauthenticated = useRef(false);

  useEffect(() => {
    const nextState = nextSignedInRedirectState({
      loading,
      hasSession: Boolean(session),
      sawUnauthenticated: sawUnauthenticated.current,
    });
    sawUnauthenticated.current = nextState.sawUnauthenticated;
    if (nextState.redirect) router.replace(returnTo);
  }, [loading, returnTo, router, session]);

  return null;
}
