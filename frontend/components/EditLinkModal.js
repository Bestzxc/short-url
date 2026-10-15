'use client';

import { useState } from 'react';
import Modal from './Modal';
import { toLocalValue } from './DateTimePickerModal';
import LinkSettingsFields, {
  SETTINGS_FIELD_ORDER,
  settingsFieldId,
  validateSettings,
} from './LinkSettingsFields';
import { PASSWORD_TOO_LONG } from '@/lib/password';
import { formatNumber } from '@/lib/format';

const ID_PREFIX = 'edit-link';

// Popup for editing a link's settings: name, expiry, click limit and password.
// The destination URL is deliberately NOT editable (shared links / QR codes would silently
// start pointing somewhere else).
export default function EditLinkModal({ link, onSave, onClose }) {
  // Settings the link has right now; the password itself is never sent to the browser
  const [initial] = useState(() => ({
    title: link.title ?? '',
    expiresAt: link.expiresAt ? toLocalValue(new Date(link.expiresAt)) : '',
    maxClicks: link.maxClicks != null ? String(link.maxClicks) : '',
  }));
  const [values, setValues] = useState({ ...initial, linkPassword: '' });
  const [enabled, setEnabled] = useState({
    title: Boolean(link.title),
    expiresAt: Boolean(link.expiresAt),
    maxClicks: link.maxClicks != null,
    linkPassword: link.hasPassword,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function setValue(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function toggle(name, on) {
    setEnabled((prev) => ({ ...prev, [name]: on }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (on) setTimeout(() => document.getElementById(settingsFieldId(ID_PREFIX, name))?.focus(), 60);
    else setValues((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validateSettings(enabled, values, { initial, passwordRequired: !link.hasPassword });
    setErrors(found);
    const first = SETTINGS_FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.getElementById(settingsFieldId(ID_PREFIX, first))?.focus();
      return;
    }

    // A switched-off setting is removed; for the password, an empty field keeps the current one
    const body = {
      title: enabled.title ? values.title.trim() : '',
      expiresAt: enabled.expiresAt
        ? values.expiresAt === initial.expiresAt && link.expiresAt
          ? link.expiresAt // unchanged: send the exact stored moment back
          : new Date(values.expiresAt).toISOString()
        : null,
      maxClicks: enabled.maxClicks ? Number(values.maxClicks) : null,
    };
    if (!enabled.linkPassword) body.linkPassword = null;
    else if (values.linkPassword) body.linkPassword = values.linkPassword;

    setSaving(true);
    try {
      await onSave(body);
    } catch (err) {
      if (err.field) {
        setErrors({ [err.field]: err.message });
        document.getElementById(settingsFieldId(ID_PREFIX, err.field))?.focus();
      } else {
        setErrors({ form: err.message });
      }
      setSaving(false);
    }
  }

  const clicksLimit = Number(values.maxClicks);
  const limitAlreadyReached = enabled.maxClicks && values.maxClicks !== '' && clicksLimit <= link.clickCount;
  const isUnchangedLimit = values.maxClicks === initial.maxClicks;
  const hints = {
    expiresAt:
      link.status === 'expired' && enabled.expiresAt && values.expiresAt === initial.expiresAt
        ? 'ลิงก์นี้หมดอายุแล้ว เลือกวันใหม่เพื่อเปิดใช้อีกครั้ง'
        : undefined,
    maxClicks:
      link.status === 'limit-reached' && enabled.maxClicks && isUnchangedLimit
        ? 'ลิงก์นี้คลิกครบแล้ว เพิ่มจำนวนเพื่อเปิดใช้อีกครั้ง'
        : limitAlreadyReached
          ? `มีคนคลิกแล้ว ${formatNumber(link.clickCount)} ครั้ง ลิงก์จะ "คลิกครบแล้ว" ทันที`
          : undefined,
    linkPassword: link.hasPassword ? 'เว้นว่าง = ใช้รหัสเดิม · ปิดสวิตช์ = ลบรหัส' : undefined,
  };

  return (
    <Modal title="แก้ไขลิงก์" onClose={saving ? () => {} : onClose} wide>
      <form onSubmit={handleSubmit} noValidate>
        <p className="break-all font-semibold text-brand">{link.shortUrl}</p>
        <p className="mb-1 truncate text-sm text-neutral-600" title={link.originalUrl}>{link.originalUrl}</p>
        <p className="mb-4 text-xs text-neutral-500">เปลี่ยนปลายทางไม่ได้ เพื่อไม่ให้ลิงก์และ QR Code ที่แชร์ไปแล้วพาไปที่อื่น ถ้าต้องการให้สร้างลิงก์ใหม่</p>

        <LinkSettingsFields
          idPrefix={ID_PREFIX}
          enabled={enabled}
          values={values}
          errors={errors}
          onToggle={toggle}
          onChange={setValue}
          onPasswordLimit={() => setErrors((prev) => ({ ...prev, linkPassword: PASSWORD_TOO_LONG }))}
          hints={hints}
          passwordPlaceholder={link.hasPassword ? '•••• (รหัสเดิม)' : undefined}
        />

        {errors.form && <p className="alert-error mt-4">{errors.form}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="btn btn-outline">ยกเลิก</button>
          <button type="submit" disabled={saving} className="btn btn-primary px-10">
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
