'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, wide = false, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rendered straight into <body>: inside a transformed parent (e.g. an animated row) `position: fixed`
  // would be measured against that parent instead of the screen.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[94vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:px-8 sm:py-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-neutral-400 hover:bg-paper hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
