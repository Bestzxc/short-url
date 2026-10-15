'use client';

import { useState } from 'react';
import Modal from './Modal';

// Asks the user to confirm before a link (and its click history) is deleted
export default function DeleteLinkModal({ link, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <Modal title="ลบลิงก์นี้ใช่ไหม?" onClose={deleting ? () => {} : onClose}>
      <div className="flex gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v6M14 11v6" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="break-all font-semibold text-brand">{link.shortUrl}</p>
          <p className="truncate text-sm text-neutral-600" title={link.originalUrl}>{link.originalUrl}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-neutral-600">การลบไม่สามารถย้อนกลับได้</p>

      {error && <p className="alert-error mt-4">{error}</p>}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button onClick={onClose} disabled={deleting} className="btn btn-outline">ยกเลิก</button>
        <button onClick={handleConfirm} disabled={deleting} autoFocus className="btn btn-primary">
          {deleting ? 'กำลังลบ…' : 'ลบลิงก์'}
        </button>
      </div>
    </Modal>
  );
}
