'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import LineChart from './LineChart';
import Pager from './Pager';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';

const DEVICE_LABELS = { desktop: 'คอมพิวเตอร์', mobile: 'มือถือ', tablet: 'แท็บเล็ต' };
const RANGES = [
  { value: '7', label: '7 วัน' },
  { value: '14', label: '14 วัน' },
  { value: '30', label: '30 วัน' },
  { value: 'all', label: 'ทั้งหมด' },
];
const PAGE_SIZE = 10;

const timeFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const secondsFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export default function StatsModal({ link, onClose }) {
  const [range, setRange] = useState('7');
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);

  // Click history: 10 rows per page, chosen with page numbers
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [clicksError, setClicksError] = useState('');
  const [loadingClicks, setLoadingClicks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api(`/links/${link.linkId}/stats?range=${range}&tz=${new Date().getTimezoneOffset()}`)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setStatsError('');
      })
      .catch((err) => !cancelled && setStatsError(err.message))
      .finally(() => !cancelled && setLoadingStats(false));
    return () => {
      cancelled = true;
    };
  }, [link.linkId, range]);

  useEffect(() => {
    let cancelled = false;
    api(`/links/${link.linkId}/clicks?page=${page}&limit=${PAGE_SIZE}`)
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        setClicksError('');
      })
      .catch((err) => !cancelled && setClicksError(err.message))
      .finally(() => !cancelled && setLoadingClicks(false));
    return () => {
      cancelled = true;
    };
  }, [link.linkId, page]);

  const goToPage = (n) => {
    setLoadingClicks(true);
    setPage(n);
  };

  const lastClick = stats?.link.lastClickedAt ? new Date(stats.link.lastClickedAt) : null;
  const buckets = stats?.buckets ?? [];

  return (
    <Modal title="สถิติการคลิก" onClose={onClose} wide>
      <p className="-mt-2 mb-3 break-all text-sm text-neutral-600">
        ลิงก์: <span className="font-bold text-ink">{link.title || link.shortCode}</span> · /{link.shortCode}
      </p>

      {statsError && <p className="alert-error mb-4">{statsError}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-paper p-3">
          <p className="text-xs font-medium text-neutral-500">คลิกทั้งหมด</p>
          <p className="mt-1 text-4xl font-extrabold leading-none text-brand">
            {stats ? formatNumber(stats.link.clickCount) : '–'}
            <span className="ml-1.5 text-base font-bold text-ink">ครั้ง</span>
          </p>
        </div>
        <div className="rounded-2xl bg-paper p-3">
          <p className="text-xs font-medium text-neutral-500">คลิกล่าสุด</p>
          <p className="mt-1 text-2xl font-extrabold leading-none text-ink">
            {lastClick ? `${timeFormat.format(lastClick)} น.` : '–'}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{lastClick ? dateFormat.format(lastClick) : 'ยังไม่มีการคลิก'}</p>
        </div>
      </div>

      <div className="mt-2 flex min-h-[26px] flex-wrap gap-2 text-xs">
        {stats && stats.link.clickCount > 0 && Object.entries(DEVICE_LABELS).map(([key, label]) => (
            <span key={key} className="rounded-full bg-paper px-3 py-1 text-neutral-600">
              {label} <b className="text-ink">{formatNumber(stats.devices[key] ?? 0)}</b>
            </span>
          ))}
      </div>

      <section className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-ink">จำนวนคลิกตามช่วงเวลา</h3>
          <div role="tablist" aria-label="ช่วงเวลา" className="flex rounded-full bg-paper p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={range === r.value}
                onClick={() => {
                  setLoadingStats(true);
                  setRange(r.value);
                }}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  range === r.value ? 'bg-brand text-white' : 'text-neutral-600 hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`h-[150px] transition-opacity ${loadingStats ? 'opacity-50' : ''}`}>
          {stats && (
            <LineChart
              data={buckets.map((b) => ({ day: b.key, clicks: b.clicks }))}
              unit={stats.unit}
              height={150}
            />
          )}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="mb-2 font-bold text-ink">ประวัติการคลิกล่าสุด</h3>
        {clicksError && <p className="alert-error mb-2">{clicksError}</p>}
        {history?.total === 0 ? (
          <p className="flex min-h-[291px] items-center justify-center rounded-2xl bg-paper text-sm text-neutral-500">ยังไม่มีการคลิก</p>
        ) : (
          <ul className={`divide-y divide-neutral-100 min-h-[291px] rounded-2xl border border-neutral-200 text-sm transition-opacity ${loadingClicks ? 'opacity-50' : ''}`}>
            {(history?.clicks ?? []).map((click) => {
              const at = new Date(click.clickedAt);
              return (
                <li key={click.clickId} className="flex h-7 items-center justify-between gap-3 px-4">
                  <span className="tabular-nums text-ink">
                    {dateFormat.format(at)} · {secondsFormat.format(at)}
                  </span>
                  <span className="shrink-0 text-neutral-500">{DEVICE_LABELS[click.deviceType] ?? click.deviceType}</span>
                </li>
              );
            })}
          </ul>
        )}
        {history && history.total > 0 && (
          <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              แสดง {formatNumber((history.page - 1) * history.limit + 1)}–
              {formatNumber((history.page - 1) * history.limit + history.clicks.length)} จากทั้งหมด {formatNumber(history.total)} ครั้ง
            </span>
            {history.totalPages > 1 && <Pager page={history.page} totalPages={history.totalPages} onChange={goToPage} />}
          </div>
        )}
      </section>
    </Modal>
  );
}
