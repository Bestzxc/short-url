'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import { useToasts } from '@/components/Toast';
import FieldError, { INVALID } from '@/components/FieldError';
import { PASSWORD_TOO_LONG } from '@/lib/password';
import LinkSettingsFields, {
  EMPTY_SETTINGS,
  NO_SETTINGS_ENABLED,
  SETTINGS_FIELD_ORDER,
  settingsFieldId,
  validateSettings,
} from '@/components/LinkSettingsFields';

export default function DashboardPage() {
  const { handleSessionError } = useSession();

  return (
    // Scrolls inside itself on short screens; my-auto keeps the content centred otherwise
    <main className="flex w-full flex-1 flex-col overflow-y-auto lg:min-h-0">
      <div className="mx-auto my-auto w-full max-w-3xl px-4 py-8 text-center sm:px-6">
        <h1 className="text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-6xl">
          Shorten <span className="text-brand">Your</span> Link
        </h1>
        <p className="mt-3 text-lg text-neutral-600">ย่อลิงก์ให้สั้น พร้อม QR Code และสถิติการคลิก</p>

        <ShortenForm onError={handleSessionError} />
      </div>
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
    return 'URL ไม่ถูกต้อง เช่น https://www.example.com/';
  }
}

const FIELD_ORDER = ['originalUrl', ...SETTINGS_FIELD_ORDER];
const ID_PREFIX = 'new-link';

function ShortenForm({ onError }) {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState(EMPTY_SETTINGS);
  const [enabled, setEnabled] = useState(NO_SETTINGS_ENABLED);
  // Newly created links are announced with a notification at the bottom right
  const { push: pushToast } = useToasts();
  // One message per field: originalUrl, title, expiresAt, maxClicks, linkPassword (or `form` for general errors)
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function setOption(name, value) {
    setOptions((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function focusField(field) {
    document.getElementById(field === 'originalUrl' ? 'url-input' : settingsFieldId(ID_PREFIX, field))?.focus();
  }

  function toggleOption(name, on) {
    setEnabled((prev) => ({ ...prev, [name]: on }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (on) setTimeout(() => focusField(name), 60);
    else setOptions((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    const urlProblem = validateUrl(url);
    if (urlProblem) found.originalUrl = urlProblem;
    Object.assign(found, validateSettings(enabled, options));
    setErrors(found);

    const firstField = FIELD_ORDER.find((f) => found[f]);
    if (firstField) {
      focusField(firstField);
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        originalUrl: url,
        title: enabled.title ? options.title.trim() : undefined,
        expiresAt: enabled.expiresAt ? new Date(options.expiresAt).toISOString() : undefined,
        maxClicks: enabled.maxClicks ? Number(options.maxClicks) : undefined,
        linkPassword: enabled.linkPassword ? options.linkPassword : undefined,
      };
      const { link } = await api('/links', { method: 'POST', body });
      pushToast({ kind: 'created', link });
      setUrl('');
      setOptions(EMPTY_SETTINGS);
      setEnabled(NO_SETTINGS_ENABLED);
    } catch (err) {
      if (err.status === 401) {
        onError(err);
      } else if (err.field) {
        // The backend named the field that failed
        setErrors({ [err.field]: err.message });
        focusField(err.field);
      } else {
        setErrors({ form: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 text-left">
      <form onSubmit={handleSubmit} noValidate>
        {/* Box 1: the URL to shorten (the result appears as a notification at the bottom right) */}
        <div className="card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <input
              id="url-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              aria-label="URL ที่ต้องการย่อ"
              aria-invalid={Boolean(errors.originalUrl)}
              aria-describedby={errors.originalUrl ? 'url-error' : undefined}
              placeholder="วาง URL ที่ต้องการย่อ เช่น https://www.example.com/"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setErrors((prev) => ({ ...prev, originalUrl: undefined }));
              }}
              className={`input ${errors.originalUrl ? INVALID : 'border-transparent bg-paper'}`}
            />
            <FieldError id="url-error" message={errors.originalUrl} />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary px-8 py-3 text-lg">
            {submitting ? 'กำลังย่อ…' : 'ย่อลิงก์'}
          </button>
        </div>

        {errors.form && <p className="alert-error mx-1 mt-3">{errors.form}</p>}
        </div>

        {/* Box 2: separate box for the optional settings */}
        <div className="card mt-4 p-4">
          <h2 className="pl-1 text-lg font-extrabold">ปรับแต่งลิงก์</h2>
          <p className="mb-4 pl-1 text-sm text-neutral-600">เปิดสวิตช์ของตัวเลือกที่ต้องการ (ไม่บังคับ)</p>
          <LinkSettingsFields
            idPrefix={ID_PREFIX}
            enabled={enabled}
            values={options}
            errors={errors}
            onToggle={toggleOption}
            onChange={setOption}
            onPasswordLimit={() => setErrors((prev) => ({ ...prev, linkPassword: PASSWORD_TOO_LONG }))}
          />
        </div>
      </form>

    </div>
  );
}
