'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';

const DEVICE_LABELS = { desktop: 'คอมพิวเตอร์', mobile: 'มือถือ', tablet: 'แท็บเล็ต' };
const DAYS = 14;

function localDayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Last 14 local days, oldest first, with zero for days without clicks
function fillDays(daily) {
  const counts = new Map(daily.map((d) => [d.day, d.clicks]));
  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push({ key: localDayKey(date), date, clicks: counts.get(localDayKey(date)) ?? 0 });
  }
  return days;
}

export default function StatsModal({ link, onClose }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/links/${link.linkId}/stats?tz=${new Date().getTimezoneOffset()}`)
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [link.linkId]);

  return (
    <Modal title="สถิติการคลิก" onClose={onClose}>
      <p className="mb-5 break-all font-medium text-brand">{link.shortUrl}</p>
      {error && <p className="alert-error">{error}</p>}
      {!stats && !error && <p className="text-neutral-500">กำลังโหลด…</p>}
      {stats && <StatsBody stats={stats} />}
    </Modal>
  );
}

function StatsBody({ stats }) {
  const total = stats.link.clickCount;
  const days = fillDays(stats.daily);
  const maxDay = Math.max(1, ...days.map((d) => d.clicks));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-paper p-4">
          <p className="text-xs font-medium tracking-widest text-neutral-500">TOTAL</p>
          <p className="text-5xl font-extrabold leading-tight text-brand">{formatNumber(total)}</p>
          <p className="font-bold">CLICKS</p>
        </div>
        <div className="flex flex-col justify-center rounded-2xl bg-paper p-4">
          <p className="text-xs font-medium tracking-widest text-neutral-500">คลิกล่าสุด</p>
          <p className="mt-2 font-semibold">{formatDateTime(stats.link.lastClickedAt)}</p>
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-bold text-ink">แยกตามอุปกรณ์</h3>
        <div className="space-y-2">
          {Object.entries(DEVICE_LABELS).map(([key, label]) => {
            const count = stats.devices[key] ?? 0;
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-neutral-600">{label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right font-normal tabular-nums">
                  {formatNumber(count)} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-bold text-ink">{DAYS} วันล่าสุด</h3>
        <div className="flex h-32 items-end gap-1">
          {days.map((d) => (
            <div key={d.key} className="flex h-full flex-1 flex-col justify-end" title={`${d.date.toLocaleDateString('th-TH')}: ${d.clicks} คลิก`}>
              <div
                className="rounded-t bg-brand"
                style={{ height: `${(d.clicks / maxDay) * 100}%`, minHeight: d.clicks ? 4 : 1 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>{days[0].date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
          <span>วันนี้</span>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-bold text-ink">การคลิกล่าสุด</h3>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-neutral-500">ยังไม่มีการคลิก</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {stats.recent.map((click, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span className="text-neutral-600">{formatDateTime(click.clickedAt)}</span>
                <span className="font-normal">{DEVICE_LABELS[click.deviceType] ?? click.deviceType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
