'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import LinkRow from '@/components/LinkRow';
import DeleteLinkModal from '@/components/DeleteLinkModal';
import QrModal from '@/components/QrModal';
import StatsModal from '@/components/StatsModal';

export default function MyLinksPage() {
  const { handleSessionError } = useSession();
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [qrLink, setQrLink] = useState(null);
  const [statsLink, setStatsLink] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:min-h-0">
        <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">ลิงก์ของฉัน</h1>
            <p className="mt-2 text-neutral-600">ประวัติลิงก์ที่คุณสร้าง และจำนวนคลิกของแต่ละลิงก์</p>
          </div>
          <button onClick={refresh} className="btn btn-outline btn-sm shrink-0">รีเฟรช</button>
        </div>

        {error && <p className="alert-error mb-4 shrink-0">{error}</p>}

        {/* The list scrolls inside this box so the page itself never scrolls on desktop */}
        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
          {links === null ? (
            <p className="text-neutral-500">กำลังโหลด…</p>
          ) : links.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-neutral-500">ยังไม่มีลิงก์</p>
              <Link href="/dashboard" className="btn btn-primary mt-4">ย่อลิงก์แรกของคุณ</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {links.map((link) => (
                <LinkRow
                  key={link.linkId}
                  link={link}
                  onQr={() => setQrLink(link)}
                  onStats={() => setStatsLink(link)}
                  onDelete={() => setDeleteTarget(link)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      {deleteTarget && (
        <DeleteLinkModal link={deleteTarget} onConfirm={() => deleteLink(deleteTarget)} onClose={() => setDeleteTarget(null)} />
      )}
      {qrLink && <QrModal link={qrLink} onClose={() => setQrLink(null)} />}
      {statsLink && <StatsModal link={statsLink} onClose={() => setStatsLink(null)} />}
    </>
  );
}
