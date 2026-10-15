'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import Logo from './Logo';
import Decor from './Decor';
import FieldError, { INVALID } from './FieldError';
import { PASSWORD_TOO_LONG, passwordTooLong } from '@/lib/password';
import { LockIcon } from './icons';

// Password page for protected short links. The backend checks the password, counts the click
// and returns the original URL, which we then open.
export default function UnlockForm({ code }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError('กรุณากรอกรหัสผ่าน');
      document.getElementById('unlock-password')?.focus();
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const { url } = await api(`/public/links/${encodeURIComponent(code)}/unlock`, {
        method: 'POST',
        body: { password },
      });
      window.location.href = url;
    } catch (err) {
      // 410 = link was disabled / expired / used up meanwhile, 404 = no such link
      if (err.status === 410 && err.data?.status) return router.replace(`/status/${err.data.status}`);
      if (err.status === 404) return router.replace('/status/not-found');
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Decor />
      <Logo />
      <form onSubmit={handleSubmit} noValidate className="card mt-10 w-full max-w-md p-6 sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper text-ink" aria-hidden="true">
          <LockIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">ลิงก์นี้มีรหัสผ่าน</h1>
        <p className="mt-2 text-neutral-600">กรอกรหัสผ่านที่เจ้าของลิงก์ให้ไว้ เพื่อเปิดลิงก์</p>

        <label htmlFor="unlock-password" className="mb-1.5 mt-6 block pl-4 text-sm font-medium">รหัสผ่าน</label>
        <input
          id="unlock-password"
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => {
            if (passwordTooLong(e.target.value)) {
              setError(PASSWORD_TOO_LONG);
              return;
            }
            setPassword(e.target.value);
            setError('');
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'unlock-error' : undefined}
          className={`input ${error ? INVALID : ''}`}
        />
        <FieldError id="unlock-error" message={error} />

        <button type="submit" disabled={submitting} className="btn btn-primary mt-6 w-full py-3.5 text-lg">
          {submitting ? 'กำลังตรวจสอบ…' : 'เปิดลิงก์'}
        </button>
      </form>
    </main>
  );
}
