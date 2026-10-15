'use client';

import { useState } from 'react';
import Modal from './Modal';
import { CopyIcon } from './icons';

const COPY_LABELS = { idle: 'คัดลอกรูป', copied: 'คัดลอกรูปแล้ว ✓', failed: 'คัดลอกไม่สำเร็จ' };

export default function QrModal({ link, onClose }) {
  const src = `/api/links/${link.linkId}/qr`;
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed

  // Puts the PNG itself on the clipboard (paste it into chat, docs, slides…). Needs https or localhost.
  async function copyImage() {
    try {
      const png = fetch(src).then((res) => {
        if (!res.ok) throw new Error('qr');
        return res.blob();
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  }

  return (
    <Modal title="QR Code" onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="rounded-3xl bg-paper p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG is generated per user by the API */}
          <img src={src} alt={`QR Code ของ ${link.shortUrl}`} width={240} height={240} className="rounded-2xl bg-white" />
        </div>
        <p className="mt-4 break-all text-center font-medium text-brand">{link.shortUrl}</p>
        <p className="mt-1 text-center text-sm text-neutral-500">สแกนแล้วจะเปิดไปที่ URL ต้นฉบับ</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={copyImage} className="btn btn-outline gap-2 px-6 py-3">
            {copyState === 'idle' && <CopyIcon />}
            {COPY_LABELS[copyState]}
          </button>
          <a href={`${src}?download=1`} download={`qr-${link.shortCode}.png`} className="btn btn-primary px-8 py-3">
            ดาวน์โหลด PNG
          </a>
        </div>
      </div>
    </Modal>
  );
}
