'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import Logo from './Logo';
import Decor from './Decor';
import FieldError, { INVALID } from './FieldError';

const COPY = {
  login: {
    title: 'เข้าสู่ระบบ',
    subtitle: 'ยินดีต้อนรับกลับมา จัดการลิงก์ของคุณได้เลย',
    submit: 'เข้าสู่ระบบ',
    switchText: 'ยังไม่มีบัญชี?',
    switchLink: 'สมัครสมาชิก',
    switchHref: '/register',
  },
  register: {
    title: 'สมัครสมาชิก',
    subtitle: 'สร้างบัญชีฟรี เริ่มย่อลิงก์ได้ทันที',
    submit: 'สมัครสมาชิก',
    switchText: 'มีบัญชีแล้ว?',
    switchLink: 'เข้าสู่ระบบ',
    switchHref: '/login',
  },
};

const FEATURES = [
  ['LINK', 'ย่อ URL ยาวๆ ให้สั้น พร้อมแชร์'],
  ['QR', 'สร้าง QR Code ดาวน์โหลดเป็นรูปภาพ'],
  ['STATS', 'ดูจำนวนคลิก แยกตามวันและอุปกรณ์'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { email?, password? } with a Thai reason for each field that fails
function validate(mode, email, password) {
  const errors = {};
  const value = email.trim();
  if (!value) errors.email = 'กรุณากรอกอีเมล';
  else if (!EMAIL_RE.test(value)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com';

  if (!password) errors.password = 'กรุณากรอกรหัสผ่าน';
  else if (mode === 'register' && password.length < 8) errors.password = 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร';
  else if (password.length > 72) errors.password = 'รหัสผ่านยาวเกินไป ต้องไม่เกิน 72 ตัวอักษร';
  return errors;
}

export default function AuthForm({ mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[mode];

  function updateField(name, value, setter) {
    setter(value);
    // Clear a field's message as soon as the user starts fixing it
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const errors = validate(mode, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(errors.email ? 'email' : 'password')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await api(`/auth/${mode}`, { method: 'POST', body: { email: email.trim(), password } });
      router.replace('/dashboard');
    } catch (err) {
      // Duplicate email belongs to the email field; everything else is a general message
      if (err.status === 409) setFieldErrors({ email: err.message });
      else setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <Decor />

      <section className="relative overflow-hidden bg-ink px-6 py-10 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/90" aria-hidden="true" />
        <div className="absolute -right-10 top-40 h-40 w-40 rounded-full border-[18px] border-white/5" aria-hidden="true" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative mt-10 lg:mt-0">
          <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            ย่อลิงก์ให้<span className="text-brand">สั้น</span>
            <br />
            แชร์ง่าย ติดตามได้
          </h2>
          <ul className="mt-8 hidden space-y-5 sm:block">
            {FEATURES.map(([tag, text]) => (
              <li key={tag} className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-lg font-extrabold tracking-wide text-brand">{tag}</span>
                <span className="text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 hidden text-sm text-white/40 lg:block">React (Next.js) · Node.js (Express) · MySQL</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <form onSubmit={handleSubmit} noValidate className="w-full max-w-md">
          <h1 className="text-4xl font-extrabold">{copy.title}</h1>
          <p className="mt-2 text-neutral-600">{copy.subtitle}</p>

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block pl-4 text-sm font-medium" htmlFor="email">อีเมล</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => updateField('email', e.target.value, setEmail)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={`input ${fieldErrors.email ? INVALID : ''}`}
              />
              <FieldError id="email-error" message={fieldErrors.email} />
            </div>
            <div>
              <label className="mb-1.5 block pl-4 text-sm font-medium" htmlFor="password">รหัสผ่าน</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => updateField('password', e.target.value, setPassword)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`input ${fieldErrors.password ? INVALID : ''}`}
              />
              <FieldError id="password-error" message={fieldErrors.password} />
              {mode === 'register' && !fieldErrors.password && (
                <p className="mt-1.5 pl-4 text-xs text-neutral-500">อย่างน้อย 8 ตัวอักษร</p>
              )}
            </div>
          </div>

          {error && <p className="alert-error mt-5">{error}</p>}

          <button type="submit" disabled={submitting} className="btn btn-primary mt-8 w-full py-3.5 text-lg">
            {submitting ? 'กำลังดำเนินการ…' : copy.submit}
          </button>

          <p className="mt-6 text-center text-neutral-600">
            {copy.switchText}{' '}
            <Link href={copy.switchHref} className="font-semibold text-brand hover:underline">
              {copy.switchLink}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
