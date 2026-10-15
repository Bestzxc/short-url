'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useSession } from '@/components/AppShell';
import LineChart from '@/components/LineChart';
import { CalendarIcon, ClickIcon, LinkIcon, TrendIcon, TrophyIcon } from '@/components/icons';

const RANGES = [
  { days: 7, label: '7 วันล่าสุด' },
  { days: 30, label: '30 วันล่าสุด' },
];

export default function StatsPage() {
  const { handleSessionError } = useSession();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Reload whenever the range changes; `cancelled` drops an answer that arrives after a newer request
  useEffect(() => {
    let cancelled = false;
    api(`/stats?days=${days}&tz=${new Date().getTimezoneOffset()}`)
      .then((result) => {
        if (cancelled) return;
        setError('');
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) handleSessionError(err);
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days, handleSessionError]);

  const loading = !data || data.days !== days;
  const top = data?.topLink;
  const topName = top ? top.title || top.shortUrl.split('/').pop() : '–';

  return (
    <main className="flex w-full flex-1 flex-col overflow-y-auto lg:min-h-0">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">สถิติการคลิก</h1>
            <p className="mt-2 text-neutral-600">วิเคราะห์ประสิทธิภาพลิงก์ทั้งหมดของคุณ</p>
          </div>

          <fieldset className="m-0 inline-flex min-w-0 items-center gap-1 rounded-full border-0 bg-white p-1 ring-1 ring-neutral-300">
            <legend className="sr-only">ช่วงเวลา</legend>
            <CalendarIcon className="ml-2.5 h-4 w-4 text-neutral-500" />
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setDays(range.days)}
                aria-pressed={days === range.days}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  days === range.days ? 'bg-brand text-white shadow-sm shadow-brand/30' : 'text-neutral-600 hover:bg-paper'
                }`}
              >
                {range.label}
              </button>
            ))}
          </fieldset>
        </div>

        {error && <p className="alert-error mt-4">{error}</p>}

        <div className={`transition-opacity duration-200 ${loading && data ? 'opacity-50' : ''}`} aria-busy={loading}>
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="สรุป">
            <StatTile icon={ClickIcon} label="คลิกทั้งหมด" value={data ? formatNumber(data.totalClicks) : '–'} caption="Total Clicks" accent />
            <StatTile icon={LinkIcon} label="ลิงก์ทั้งหมด" value={data ? formatNumber(data.totalLinks) : '–'} caption="Total Links" />
            <StatTile icon={TrendIcon} label="เฉลี่ยต่อวัน" value={data ? formatNumber(data.avgPerDay) : '–'} caption="Clicks / Day" />
            <StatTile
              icon={TrophyIcon}
              label="ลิงก์ยอดนิยม"
              value={data ? topName : '–'}
              caption={top ? 'ชื่อของลิงก์ที่คลิกมากที่สุด' : 'ยังไม่มีการคลิก'}
              small
            />
          </section>

          <section className="card mt-4 p-5 sm:p-6">
            <h2 className="text-xl font-extrabold">จำนวนคลิกตามวัน</h2>
            <p className="mb-4 text-sm text-neutral-500">จำนวนคลิกในช่วง {days} วัน</p>
            {data ? (
              <LineChart data={data.daily} />
            ) : (
              <div className="h-56 animate-pulse rounded-2xl bg-paper" aria-hidden="true" />
            )}
            {data?.totalClicks === 0 && <p className="mt-2 text-center text-sm text-neutral-500">ยังไม่มีการคลิกในช่วงนี้</p>}
          </section>

          <section className="card mt-4 p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold">ลิงก์ที่มีผู้คลิกมากที่สุด</h2>
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">Top 5</span>
            </div>
            {data && data.topLinks.length > 0 ? (
              <ol className="divide-y divide-neutral-100">
                {data.topLinks.map((link, index) => (
                  <li key={link.linkId} className="flex items-center gap-3 py-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-brand text-white' : 'bg-paper text-neutral-600'}`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{link.title || link.shortUrl}</p>
                      <p className="truncate text-sm text-neutral-500" title={link.originalUrl}>{link.shortUrl}</p>
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="text-xl font-extrabold">{formatNumber(link.clicks)}</span>{' '}
                      <span className="text-sm text-neutral-500">คลิก</span>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-6 text-center text-neutral-500">{data ? 'ยังไม่มีลิงก์ที่ถูกคลิกในช่วงนี้' : 'กำลังโหลด…'}</p>
            )}
            <Link href="/links?sort=clicks" className="btn btn-outline mt-3 w-full">
              ดูสถิติลิงก์ทั้งหมด <span aria-hidden="true">→</span>
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}

// One number tile: icon + Thai label, big value, small English caption underneath
function StatTile({ icon: Icon, label, value, caption, accent = false, small = false }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-neutral-600">
        <Icon className="h-4 w-4" /> {label}
      </p>
      <p
        className={`mt-2 truncate font-extrabold leading-tight tracking-tight ${small ? 'text-2xl' : 'text-4xl'} ${accent ? 'text-brand' : ''}`}
        title={String(value)}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-neutral-500">{caption}</p>
    </div>
  );
}
