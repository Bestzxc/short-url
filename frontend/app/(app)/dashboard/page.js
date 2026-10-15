'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useSession } from '@/components/AppShell';
import CopyButton from '@/components/CopyButton';
import FieldError, { INVALID } from '@/components/FieldError';

export default function DashboardPage() {
  const { handleSessionError } = useSession();
  const [links, setLinks] = useState(null);

  useEffect(() => {
    api('/links')
      .then((data) => setLinks(data.links))
      .catch(handleSessionError);
  }, [handleSessionError]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 text-center sm:px-6 lg:min-h-0">
      <h1 className="text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-6xl">
        Shorten <span className="text-brand">Your</span> Link
      </h1>
      <p className="mt-3 text-lg text-neutral-600">ย่อลิงก์ให้สั้น พร้อม QR Code และสถิติการคลิก</p>

      <ShortenForm
        onCreated={(link) => setLinks((prev) => [link, ...(prev ?? [])])}
        onError={handleSessionError}
      />
      <Summary links={links} />

      <Link href="/links" className="btn btn-outline mx-auto mt-8">
        ดูลิงก์ของฉัน →
      </Link>
    </main>
  );
}

// Mirrors the backend check (lib/links.js normalizeUrl): http(s) only, host needs a dot
function validateUrl(input) {
  const value = input.trim();
  if (!value) return 'กรุณากรอก URL ที่ต้องการย่อ';
  if (value.length > 2048) return 'URL ยาวเกินไป ต้องไม่เกิน 2,048 ตัวอักษร';
  if (/\s/.test(value)) return 'URL ต้องไม่มีช่องว่าง';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'รองรับเฉพาะ URL ที่ขึ้นต้นด้วย http:// หรือ https://';
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return 'URL ไม่ถูกต้อง ชื่อเว็บต้องมีจุด เช่น example.com';
    return '';
  } catch {
    return 'URL ไม่ถูกต้อง เช่น https://www.synerry.com/';
  }
}

function ShortenForm({ onCreated, onError }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validateUrl(url);
    setError(problem);
    if (problem) {
      document.getElementById('url-input')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { link } = await api('/links', { method: 'POST', body: { originalUrl: url } });
      setResult(link);
      setUrl('');
      onCreated(link);
    } catch (err) {
      if (err.status === 401) onError(err);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mt-8 p-3 text-left">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <input
            id="url-input"
            type="text"
            inputMode="url"
            autoFocus
            aria-label="URL ที่ต้องการย่อ"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'url-error' : undefined}
            placeholder="วาง URL ที่ต้องการย่อ เช่น https://www.synerry.com/"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            className={`input ${error ? INVALID : 'border-transparent bg-paper'}`}
          />
          <FieldError id="url-error" message={error} />
        </div>
        <button type="submit" disabled={submitting} className="btn btn-primary px-8 py-3 text-lg">
          {submitting ? 'กำลังย่อ…' : 'ย่อลิงก์'}
        </button>
      </form>
      {result && (
        <div className="mx-1 mt-3 flex flex-col gap-3 rounded-2xl bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-neutral-600">Short URL ของคุณ</p>
            <a href={result.shortUrl} target="_blank" rel="noopener noreferrer" className="break-all text-lg font-semibold text-brand hover:underline">
              {result.shortUrl}
            </a>
          </div>
          <CopyButton text={result.shortUrl} />
        </div>
      )}
    </div>
  );
}

function Summary({ links }) {
  const totalLinks = links?.length ?? 0;
  const totalClicks = links?.reduce((sum, l) => sum + l.clickCount, 0) ?? 0;
  const avg = totalLinks ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0;
  const items = [
    ['TOTAL', totalLinks, 'LINKS'],
    ['TOTAL', totalClicks, 'CLICKS'],
    ['AVERAGE', avg, 'CLICKS / LINK'],
  ];

  return (
    <section className="mt-10 grid grid-cols-3 gap-2 text-center sm:gap-4">
      {items.map(([top, value, bottom]) => (
        <div key={bottom}>
          <p className="text-xs font-normal tracking-widest text-neutral-500 sm:text-base">{top}</p>
          <p className="text-4xl font-extrabold leading-none tracking-tight text-brand sm:text-6xl">
            {links ? formatNumber(value) : '–'}
          </p>
          <p className="mt-1 text-xs font-extrabold sm:text-lg">{bottom}</p>
        </div>
      ))}
    </section>
  );
}
