'use client';

import Modal from './Modal';

export default function QrModal({ link, onClose }) {
  const src = `/api/links/${link.linkId}/qr`;

  return (
    <Modal title="QR Code" onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="rounded-3xl bg-paper p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG is generated per user by the API */}
          <img src={src} alt={`QR Code ของ ${link.shortUrl}`} width={240} height={240} className="rounded-2xl bg-white" />
        </div>
        <p className="mt-4 break-all text-center font-medium text-brand">{link.shortUrl}</p>
        <p className="mt-1 text-center text-sm text-neutral-500">สแกนแล้วจะเปิดไปที่ URL ต้นฉบับ</p>
        <a href={`${src}?download=1`} download={`qr-${link.shortCode}.png`} className="btn btn-primary mt-6 px-8 py-3">
          ดาวน์โหลด PNG
        </a>
      </div>
    </Modal>
  );
}
