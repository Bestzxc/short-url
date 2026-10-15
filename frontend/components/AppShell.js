'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Logo from './Logo';
import Decor from './Decor';
import { ToastProvider } from './Toast';

const SessionContext = createContext(null);

// Pages call this to send the user back to the login page when their session has expired
export function useSession() {
  return useContext(SessionContext);
}

const NAV = [
  { href: '/dashboard', label: 'ย่อลิงก์' },
  { href: '/links', label: 'ลิงก์ของฉัน' },
  { href: '/stats', label: 'สถิติ' },
];

// Logged-in frame shared by /dashboard and /links: header, navigation and the session check.
// On desktop it fills exactly one screen (4px = the black strip at the top of <body>).
export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  const handleSessionError = useCallback(
    (err) => {
      if (err.status === 401) router.replace('/login');
    },
    [router],
  );

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(handleSessionError);
  }, [handleSessionError]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  }

  if (!user) {
    return <main className="flex flex-1 items-center justify-center text-neutral-500">กำลังโหลด…</main>;
  }

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-4px)] lg:flex-none lg:overflow-hidden">
      <Decor />
      <header className="sticky top-0 z-40 shrink-0 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
          <Logo href="/dashboard" />
          <nav className="order-last flex w-full items-center justify-center gap-8 border-t border-neutral-100 pt-2 font-semibold sm:order-none sm:w-auto sm:border-0 sm:pt-0">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                className={pathname === href ? 'text-brand' : 'hover:text-brand'}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-neutral-600 lg:block">{user.email}</span>
            <button onClick={logout} className="btn btn-primary shrink-0 px-5">ออกจากระบบ</button>
          </div>
        </div>
      </header>
      <SessionContext.Provider value={{ user, handleSessionError }}>
        <ToastProvider>{children}</ToastProvider>
      </SessionContext.Provider>
    </div>
  );
}
