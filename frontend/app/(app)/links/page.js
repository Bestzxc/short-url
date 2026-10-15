'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import LinkRow from '@/components/LinkRow';
import DeleteLinkModal from '@/components/DeleteLinkModal';
import EditLinkModal from '@/components/EditLinkModal';
import Pager from '@/components/Pager';
import QrModal from '@/components/QrModal';
import StatsModal from '@/components/StatsModal';
import SelectMenu from '@/components/SelectMenu';
import { FunnelIcon, LockIcon, RefreshIcon, SortIcon } from '@/components/icons';
import { useToasts } from '@/components/Toast';

const STATUS_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'ใช้งานอยู่' },
  { key: 'inactive', label: 'ปิดอยู่' },
  { key: 'expired', label: 'หมดอายุ' },
  { key: 'limit-reached', label: 'คลิกครบแล้ว' },
];

// Switched on and not expired (expired links look switched off)
const isOn = (link) => link.isActive && link.status !== 'expired';

// "เรียงตาม" choices. The server sends links newest first; linkId grows with time, so it is the
// tie-breaker that keeps every order stable.
const SORT_OPTIONS = [
  { key: 'default', label: 'เปิดก่อน, ใหม่สุด', short: 'เปิดก่อน', compare: (a, b) => Number(isOn(b)) - Number(isOn(a)) || b.linkId - a.linkId },
  { key: 'newest', label: 'ใหม่สุด', compare: (a, b) => b.linkId - a.linkId },
  { key: 'oldest', label: 'เก่าสุด', compare: (a, b) => a.linkId - b.linkId },
  { key: 'clicks', label: 'จำนวนคลิก (มากไปน้อย)', short: 'คลิกมากสุด', compare: (a, b) => b.clickCount - a.clickCount || b.linkId - a.linkId },
  { key: 'clicks-asc', label: 'จำนวนคลิก (น้อยไปมาก)', short: 'คลิกน้อยสุด', compare: (a, b) => a.clickCount - b.clickCount || b.linkId - a.linkId },
];

const PAGE_SIZE = 5;

// How a link is named in a notification: its title if it has one, otherwise its short URL
function describe(link) {
  return link.title ? `${link.title} · ${link.shortUrl}` : link.shortUrl;
}

// Case-insensitive match against everything a person might remember about a link
function matchesQuery(link, query) {
  if (!query) return true;
  const haystack = [link.title, link.shortCode, link.shortUrl, link.originalUrl].filter(Boolean).join('\n').toLowerCase();
  return haystack.includes(query);
}

// "มีรหัสผ่าน" checkbox at the bottom of the status menu
function ProtectedOnlyItem({ checked, onToggle, close, itemClass }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => {
        onToggle();
        close();
      }}
      className={itemClass}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-brand bg-brand text-white' : 'border-neutral-300'}`}
        aria-hidden="true"
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className={`flex flex-1 items-center gap-1.5 ${checked ? 'font-semibold' : ''}`}>
        <LockIcon /> มีรหัสผ่าน
      </span>
    </button>
  );
}

// useSearchParams needs a Suspense boundary in this version of Next.js
export default function MyLinksPage() {
  return (
    <Suspense fallback={null}>
      <MyLinks />
    </Suspense>
  );
}

function MyLinks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleSessionError } = useSession();
  const { push: pushToast } = useToasts();
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [qrLink, setQrLink] = useState(null);
  const [statsLink, setStatsLink] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyProtected, setOnlyProtected] = useState(false);
  const [pageState, setPageState] = useState({ key: '', page: 1 });

  // The sort order lives in the address (?sort=clicks), so the Stats page can link straight to
  // "most clicked first" and the choice survives a refresh
  const sortParam = searchParams.get('sort');
  const sort = SORT_OPTIONS.some((o) => o.key === sortParam) ? sortParam : 'default';
  const setSort = (key) => router.replace(key === 'default' ? '/links' : `/links?sort=${key}`, { scroll: false });

  const handleApiError = useCallback(
    (err) => {
      if (err.status === 401) handleSessionError(err);
      else setError(err.message);
    },
    [handleSessionError],
  );

  useEffect(() => {
    api('/links')
      .then((data) => setLinks(data.links))
      .catch(handleApiError);
  }, [handleApiError]);

  function refresh() {
    setError('');
    api('/links')
      .then((data) => setLinks(data.links))
      .catch(handleApiError);
  }

  const replaceLink = (updated) => setLinks((prev) => prev.map((l) => (l.linkId === updated.linkId ? updated : l)));

  async function toggleLink(link) {
    setTogglingId(link.linkId);
    setError('');
    try {
      const { link: updated } = await api(`/links/${link.linkId}`, { method: 'PATCH', body: { isActive: !link.isActive } });
      replaceLink(updated);
    } catch (err) {
      handleApiError(err);
    } finally {
      setTogglingId(null);
    }
  }

  // Called by the edit popup; throws so the popup can show the error and stay open
  async function saveLink(link, body) {
    try {
      const { link: updated } = await api(`/links/${link.linkId}`, { method: 'PATCH', body });
      replaceLink(updated);
      pushToast({ kind: 'updated', title: 'บันทึกการแก้ไขแล้ว', detail: describe(updated) });
    } catch (err) {
      if (err.status === 401) handleSessionError(err);
      throw err;
    }
    setEditTarget(null);
  }

  // Called by the confirm popup; throws so the popup can show the error and stay open
  async function deleteLink(link) {
    try {
      await api(`/links/${link.linkId}`, { method: 'DELETE' });
    } catch (err) {
      if (err.status === 401) handleSessionError(err);
      throw err;
    }
    setLinks((prev) => prev.filter((l) => l.linkId !== link.linkId));
    setDeleteTarget(null);
    pushToast({ kind: 'deleted', title: 'ลบลิงก์แล้ว', detail: describe(link) });
  }

  const query = search.trim().toLowerCase();
  // Links that match the search; the filter chips count within these so the numbers add up
  const searched = (links ?? []).filter((l) => matchesQuery(l, query));
  const countFor = (key) => (key === 'all' ? searched.length : searched.filter((l) => l.status === key).length);
  const compare = SORT_OPTIONS.find((o) => o.key === sort).compare;
  const visible = searched
    .filter((l) => (statusFilter === 'all' || l.status === statusFilter) && (!onlyProtected || l.hasPassword))
    .sort(compare);
  // 5 links per page; a new search / filter / sort starts again from page 1
  const pageKey = [query, statusFilter, onlyProtected, sort].join('|');
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(pageState.key === pageKey ? pageState.page : 1, totalPages);
  const pageLinks = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtering = Boolean(query) || statusFilter !== 'all' || onlyProtected;
  // Shown next to the result count, since the filters themselves live in a menu
  const activeFilterLabels = [
    statusFilter !== 'all' && STATUS_FILTERS.find((f) => f.key === statusFilter)?.label,
    onlyProtected && 'มีรหัสผ่าน',
  ].filter(Boolean);

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setOnlyProtected(false);
  }

  // What fills the list area: loading text, an empty state, "nothing matches", or the page of links
  function renderList() {
    if (links === null) return <p className="text-neutral-500">กำลังโหลด…</p>;
    if (links.length === 0) {
      return (
        <div className="card p-10 text-center">
          <p className="text-neutral-500">ยังไม่มีลิงก์</p>
          <Link href="/dashboard" className="btn btn-primary mt-4">ย่อลิงก์แรกของคุณ</Link>
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <div className="card p-10 text-center">
          <p className="font-semibold">ไม่พบลิงก์ที่ตรงกับเงื่อนไข</p>
          <p className="mt-1 text-sm text-neutral-500">ลองเปลี่ยนคำค้นหา หรือเลือกสถานะอื่น</p>
          <button onClick={clearFilters} className="btn btn-outline mt-4">ล้างการค้นหาและตัวกรอง</button>
        </div>
      );
    }
    return (
        <>
          {filtering && (
            <p className="mb-2 text-sm text-neutral-500" aria-live="polite">
              แสดง {visible.length} จาก {links.length} ลิงก์
              {activeFilterLabels.length > 0 && <> · กรอง: {activeFilterLabels.join(' + ')}</>} ·{' '}
              <button onClick={clearFilters} className="font-medium text-brand hover:underline">ล้างตัวกรอง</button>
            </p>
          )}
          <ul className={`space-y-2.5 ${totalPages > 1 ? 'md:min-h-[38.75rem]' : ''}`}>
            {pageLinks.map((link) => (
              <LinkRow
                key={link.linkId}
                link={link}
                busy={togglingId === link.linkId}
                onToggle={() => toggleLink(link)}
                onEdit={() => setEditTarget(link)}
                onQr={() => setQrLink(link)}
                onStats={() => setStatsLink(link)}
                onDelete={() => setDeleteTarget(link)}
              />
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500">
              <span>
                แสดง {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + pageLinks.length} จาก {visible.length} ลิงก์
              </span>
              <Pager page={page} totalPages={totalPages} onChange={(n) => setPageState({ key: pageKey, page: n })} />
            </div>
          )}
        </>
    );
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:min-h-0">
        <div className="mb-3 shrink-0">
          <h1 className="text-2xl font-extrabold leading-none tracking-tight sm:text-3xl">ลิงก์ของฉัน</h1>
          <p className="mt-1 text-sm text-neutral-600">ประวัติลิงก์ที่คุณสร้าง และจำนวนคลิกของแต่ละลิงก์</p>
        </div>

        {links !== null && links.length > 0 && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-[3_1_18rem]">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                autoComplete="off"
                aria-label="ค้นหาลิงก์"
                placeholder="ค้นหาชื่อ, Short URL หรือ URL ต้นฉบับ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-neutral-400 hover:bg-paper hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>

            <SelectMenu icon={SortIcon} heading="เรียงตาม" label="เรียงตาม" options={SORT_OPTIONS} value={sort} onChange={setSort} className="min-w-[7.5rem] flex-1 sm:min-w-[9.5rem] sm:flex-none" />

            <SelectMenu
              icon={FunnelIcon}
              heading="สถานะ"
              label="กรองตามสถานะ"
              className="min-w-[7.5rem] flex-1 sm:min-w-[9.5rem] sm:flex-none"
              options={STATUS_FILTERS.map(({ key, label }) => ({ key, label, count: countFor(key) }))}
              value={statusFilter}
              onChange={setStatusFilter}
              active={statusFilter !== 'all' || onlyProtected}
              FooterItem={ProtectedOnlyItem}
              footerProps={{ checked: onlyProtected, onToggle: () => setOnlyProtected((v) => !v) }}
            />

            <button
              type="button"
              onClick={refresh}
              aria-label="รีเฟรช"
              title="รีเฟรช"
              className="flex h-[3.1rem] w-[3.1rem] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-neutral-300 transition-colors hover:ring-ink"
            >
              <RefreshIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {error && <p className="alert-error mb-4 shrink-0">{error}</p>}

        {/* The list scrolls inside this box so the page itself never scrolls on desktop */}
        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderList()}
        </div>
      </main>

      {editTarget && (
        <EditLinkModal link={editTarget} onSave={(body) => saveLink(editTarget, body)} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteLinkModal link={deleteTarget} onConfirm={() => deleteLink(deleteTarget)} onClose={() => setDeleteTarget(null)} />
      )}
      {qrLink && <QrModal link={qrLink} onClose={() => setQrLink(null)} />}
      {statsLink && <StatsModal link={statsLink} onClose={() => setStatsLink(null)} />}
    </>
  );
}
