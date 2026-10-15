'use client';

import { useState } from 'react';
import { INVALID } from './FieldError';
import DateTimePickerModal from './DateTimePickerModal';

const displayFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', hour12: false });

// Expiry picker: a field that opens a calendar + time popup
export default function ExpiryInput({ id, value, onChange, invalid, describedBy }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : null;
  const label = date && !Number.isNaN(date.getTime()) ? displayFormat.format(date) : '';

  return (
    <div>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        className={`input relative flex w-full items-center pl-11 pr-4 text-left ${invalid ? INVALID : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4.5" width="18" height="16" rx="3" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
        <span className={`truncate ${label ? '' : 'text-neutral-400'}`}>{label || 'เลือกวันและเวลา'}</span>
      </button>

      {open && (
        <DateTimePickerModal
          initialValue={value}
          onConfirm={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
