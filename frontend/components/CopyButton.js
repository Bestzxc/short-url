'use client';

import { useState } from 'react';
import { CopyIcon } from './icons';

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('คัดลอกลิงก์นี้', text);
    }
  }

  return (
    <button onClick={copy} className="btn btn-dark btn-sm gap-2">
      {!copied && <CopyIcon />}
      {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
    </button>
  );
}
