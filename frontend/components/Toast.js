'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CopyButton from './CopyButton';
import { TrashIcon } from './icons';

const AUTO_DISMISS_MS = 5000; // how long a toast stays
const EXIT_MS = 350; // length of the slide-out animation (matches .animate-toast-out)
const MAX_TOASTS = 3;

// Toasts live in <ToastProvider>, mounted once by the logged-in layout (AppShell). The layout is
// never paused when the user moves between pages, so a toast keeps counting down (and is
// removed) even after navigating away from the page that created it. (A page's own state is
// paused when it is left, which would leave its toasts stuck on screen.)
//
// In any page:  const { push } = useToasts();
//   push({ kind: 'created', link })                 a link was created (shows the short URL + Copy)
//   push({ kind: 'updated', title, detail })        something was saved
//   push({ kind: 'deleted', title, detail })        something was deleted
const ToastContext = createContext({ push: () => {} });

export function useToasts() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const push = useCallback((toast) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, ...toast }].slice(-MAX_TOASTS));
  }, []);
  // Must stay a stable function: the toast timers depend on it
  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// Bottom-right notifications. Rendered into <body> so they stay put whatever the page does;
// the newest sits at the bottom.
function Toasts({ toasts, onDismiss }) {
  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-end gap-3 p-4 sm:inset-x-auto sm:right-0 sm:w-[26rem]"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast, onDismiss }) {
  const { id, kind = 'created' } = toast;
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Stays for AUTO_DISMISS_MS, but not while the pointer is over it (so Copy is never snatched away).
  // onDismiss must be a stable function, otherwise every re-render of the page would restart this timer.
  useEffect(() => {
    if (paused || leaving) return undefined;
    const timer = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [paused, leaving]);

  // After the slide-out has played, remove it for good
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => onDismiss(id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, id, onDismiss]);

  const link = toast.link;
  const title = kind === 'created' ? 'สร้างลิงก์สำเร็จ' : toast.title;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`${leaving ? 'animate-toast-out' : 'animate-toast-in'} pointer-events-auto w-full rounded-2xl bg-white p-4 shadow-xl shadow-black/15 ring-1 ring-black/5`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${kind === 'deleted' ? 'bg-ink' : 'bg-brand'}`}
          aria-hidden="true"
        >
          {kind === 'deleted' ? (
            <TrashIcon className="h-5 w-5" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{title}</p>

          {kind === 'created' && link ? (
            <>
              {link.title && <p className="truncate text-sm font-semibold" title={link.title}>{link.title}</p>}
              <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-sm font-semibold text-brand hover:underline">
                {link.shortUrl}
              </a>
              <p className="truncate text-xs text-neutral-500" title={link.originalUrl}>{link.originalUrl}</p>
              <div className="mt-3 flex items-center gap-2">
                <CopyButton text={link.shortUrl} />
                <Link href="/links" className="btn btn-outline btn-sm">ดูลิงก์ของฉัน</Link>
              </div>
            </>
          ) : (
            toast.detail && <p className="break-words text-sm text-neutral-600">{toast.detail}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="ปิดการแจ้งเตือน"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-neutral-400 hover:bg-paper hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}
