'use client';

import { formatDateTime, formatNumber } from '@/lib/format';
import CopyButton from './CopyButton';
import RowMenu from './RowMenu';
import Toggle from './Toggle';
import { ChartIcon, EditIcon, LockIcon, QrIcon, TrashIcon } from './icons';

// label = badge text, dot = colour of the dot in the badge
const STATUS = {
  active: { label: 'ใช้งานอยู่', className: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { label: 'ปิดอยู่', className: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  expired: { label: 'หมดอายุ', className: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'limit-reached': { label: 'คลิกครบแล้ว', className: 'bg-brand-soft text-brand-dark', dot: 'bg-brand' },
};

// How a row looks and what its switch says: expired = amber, switched off = grey, otherwise normal.
// An expired link can no longer be opened, so it counts as switched off (its date can be changed in the edit popup).
function rowLook(link) {
  if (link.status === 'expired') {
    return { on: false, card: 'bg-amber-100/80 shadow-none ring-amber-400', url: 'text-amber-800', switchText: 'หมดอายุ', switchLabel: 'ลิงก์หมดอายุแล้ว' };
  }
  if (!link.isActive) {
    return { on: false, card: 'bg-neutral-300/70 shadow-none ring-neutral-400', url: 'text-neutral-600', switchText: 'ปิดอยู่', switchLabel: 'เปิดลิงก์นี้' };
  }
  return { on: true, card: 'ring-neutral-300', url: 'text-brand', switchText: 'เปิดใช้งาน', switchLabel: 'ปิดลิงก์นี้' };
}

export default function LinkRow({ link, busy, onToggle, onEdit, onQr, onStats, onDelete }) {
  const status = STATUS[link.status] ?? STATUS.active;
  const outlineButton = 'btn btn-outline btn-sm gap-2';
  const look = rowLook(link);
  const off = !look.on;
  const expired = link.status === 'expired';

  return (
    <li className={`card flex flex-col gap-3 p-4 md:min-h-[7.25rem] md:gap-4 md:px-5 md:py-3 transition-colors duration-300 md:flex-row md:justify-between ring-2 ${look.card}`}>
      {/* Left: name, short URL + status, destination; dates sit at the bottom, level with the on/off switch */}
      <div className="flex min-w-0 flex-col md:flex-1">
        {link.title ? (
          <p className={`truncate text-lg font-extrabold leading-tight transition-colors duration-300 ${off ? 'text-neutral-600' : ''}`} title={link.title}>{link.title}</p>
        ) : (
          <p className="text-sm text-neutral-400">ยังไม่ได้ตั้งชื่อ</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className={`break-all text-base font-semibold transition-colors duration-300 hover:underline ${look.url}`}>
            {link.shortUrl}
          </a>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
          </span>
          {link.hasPassword && (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700" title="ต้องใส่รหัสผ่านก่อนเปิด">
              <LockIcon className="h-3.5 w-3.5" /> มีรหัสผ่าน
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-sm text-neutral-600" title={link.originalUrl}>
          {link.originalUrl}
        </p>
        <p className="mt-0.5 text-sm text-neutral-500 md:mt-auto">
          สร้างเมื่อ {formatDateTime(link.createdAt)}
          {link.expiresAt && <> · หมดอายุ {formatDateTime(link.expiresAt)}</>}
          {link.maxClicks != null && <> · จำกัด {formatNumber(link.maxClicks)} คลิก</>}
        </p>
      </div>

      {/* Right: actions on top, click count in the middle, on/off switch at the bottom */}
      <div className="flex shrink-0 flex-col gap-2 md:items-end">
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <CopyButton text={link.shortUrl} />
          <button onClick={onQr} className={outlineButton}>
            <QrIcon /> QR Code
          </button>
          <button onClick={onStats} className={outlineButton}>
            <ChartIcon /> สถิติ
          </button>
          <RowMenu
            items={[
              { label: 'แก้ไข', icon: EditIcon, onClick: onEdit },
              { label: 'ลบ', icon: TrashIcon, onClick: onDelete, danger: true },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-6 md:justify-end md:gap-5">
          <p className="flex items-baseline gap-1.5 md:justify-end" aria-label={`${formatNumber(link.clickCount)} คลิก`}>
            <span className={`text-3xl font-extrabold leading-none tracking-tight transition-colors duration-300 ${off ? 'text-neutral-600' : ''}`}>{formatNumber(link.clickCount)}</span>
            <span className="text-base font-medium text-neutral-500">คลิก</span>
          </p>

          <div className="flex items-center gap-3">
            <Toggle
              checked={look.on}
              onChange={onToggle}
              disabled={busy || expired}
              label={look.switchLabel}
            />
            <span className={`w-[4.5rem] text-sm font-semibold ${look.on ? 'text-brand' : 'text-neutral-400'}`}>
              {look.switchText}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
