'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';

// Entry point: logged-in users go to the dashboard, everyone else to the login page
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api('/auth/me')
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center text-neutral-500">กำลังโหลด…</main>
  );
}
