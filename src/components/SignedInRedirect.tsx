'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthSession } from '@/components/AuthSessionProvider';

export default function SignedInRedirect({
  returnTo = '/play',
}: {
  returnTo?: string;
}) {
  const router = useRouter();
  const { session, loading } = useAuthSession();

  useEffect(() => {
    if (!loading && session) router.replace(returnTo);
  }, [loading, returnTo, router, session]);

  return null;
}
