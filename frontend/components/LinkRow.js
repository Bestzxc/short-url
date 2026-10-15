'use client';

import { formatDateTime, formatNumber } from '@/lib/format';
import CopyButton from './CopyButton';

export default function LinkRow({ link, onQr, onStats, onDelete }) {
  return (
    <li className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-brand hover:underline">
          {link.shortUrl}
        </a>
        <p className="truncate text-sm text-neutral-600" title={link.originalUrl}>
          {link.originalUrl}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">สร้างเมื่อ {formatDateTime(link.createdAt)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={link.shortUrl} />
        <button onClick={onQr} className="btn btn-outline btn-sm">QR Code</button>
        <button onClick={onStats} className="btn btn-outline btn-sm">สถิติ</button>
        <button onClick={onDelete} className="btn btn-danger btn-sm">ลบ</button>
      </div>
      <div className="flex shrink-0 items-baseline gap-1.5 md:w-16 md:flex-col md:items-center md:gap-0">
        <span className="text-3xl font-extrabold leading-none">{formatNumber(link.clickCount)}</span>
        <span className="text-[10px] font-semibold tracking-widest text-neutral-500">CLICKS</span>
      </div>
    </li>
  );
}
