'use client';

import { INVALID } from './FieldError';
import Toggle from './Toggle';
import ExpiryInput from './ExpiryInput';
import StepperInput from './StepperInput';
import PasswordInput from './PasswordInput';
import { PASSWORD_TOO_LONG, passwordTooLong } from '@/lib/password';

// The four optional settings of a link, shared by the "shorten" form and the "edit link" popup.
// Each setting has a switch: on = the setting applies (and must be filled in), off = not used.

export const MAX_TITLE_LENGTH = 100;
export const EMPTY_SETTINGS = { title: '', expiresAt: '', maxClicks: '', linkPassword: '' };
export const NO_SETTINGS_ENABLED = { title: false, expiresAt: false, maxClicks: false, linkPassword: false };
export const SETTINGS_FIELD_ORDER = ['title', 'expiresAt', 'maxClicks', 'linkPassword'];

// Returns { field: message } for every switched-on setting that is invalid.
//   initial          values the link had before editing (an unchanged expiry is never rejected,
//                    so an already-expired link can still be renamed)
//   passwordRequired false when a password already exists: leaving the field empty keeps it
export function validateSettings(enabled, values, { initial = {}, passwordRequired = true } = {}) {
  const { title, expiresAt, maxClicks, linkPassword } = values;
  const errors = {};

  if (enabled.title) {
    if (!title.trim()) errors.title = 'กรุณากรอกชื่อลิงก์ หรือปิดตัวเลือกนี้';
    else if (title.trim().length > MAX_TITLE_LENGTH) errors.title = `ชื่อลิงก์ต้องไม่เกิน ${MAX_TITLE_LENGTH} ตัวอักษร`;
  }
  if (enabled.expiresAt) {
    const date = new Date(expiresAt);
    if (!expiresAt) errors.expiresAt = 'กรุณาเลือกวันและเวลาที่หมดอายุ หรือปิดตัวเลือกนี้';
    else if (Number.isNaN(date.getTime())) errors.expiresAt = 'วันหมดอายุไม่ถูกต้อง';
    else if (expiresAt !== initial.expiresAt && date <= new Date()) errors.expiresAt = 'วันหมดอายุต้องเป็นเวลาในอนาคต';
  }
  if (enabled.maxClicks) {
    const n = Number(maxClicks);
    if (maxClicks === '') errors.maxClicks = 'กรุณากรอกจำนวนคลิกสูงสุด หรือปิดตัวเลือกนี้';
    else if (!Number.isInteger(n) || n < 1 || n > 1000000) errors.maxClicks = 'ต้องเป็นจำนวนเต็ม 1 - 1,000,000';
  }
  if (enabled.linkPassword) {
    if (!linkPassword) {
      if (passwordRequired) errors.linkPassword = 'กรุณากรอกรหัสผ่านลิงก์ หรือปิดตัวเลือกนี้';
    } else if (linkPassword.length < 4) {
      errors.linkPassword = 'รหัสผ่านลิงก์ต้องยาวอย่างน้อย 4 ตัวอักษร';
    } else if (passwordTooLong(linkPassword)) {
      errors.linkPassword = PASSWORD_TOO_LONG;
    }
  }
  return errors;
}

// Props:
//   enabled / values / errors   state kept by the parent
//   onToggle(name, on)          a switch was flipped
//   onChange(name, value)       a field changed
//   onPasswordLimit()           typing past the password byte limit was refused
//   hints                       optional per-field replacement for the grey hint text
//   passwordPlaceholder         e.g. "เว้นว่าง = ใช้รหัสเดิม" when editing a link that has one
// idPrefix makes the input ids unique per form. Next keeps the previous page mounted (hidden) while
// another one is open, so two forms can exist at once and plain ids like "opt-title" would clash.
export function settingsFieldId(idPrefix, name) {
  return `${idPrefix}-${name}`;
}

export default function LinkSettingsFields({ idPrefix, enabled, values, errors, onToggle, onChange, onPasswordLimit, hints = {}, passwordPlaceholder = 'อย่างน้อย 4 ตัวอักษร' }) {
  const id = (name) => settingsFieldId(idPrefix, name);
  return (
    <div className="space-y-3">
      <OptionCard idPrefix={idPrefix} name="title" title="ตั้งชื่อลิงก์" hint={hints.title ?? 'ไว้ดูเอง เช่น โปรโมชั่นเดือนตุลา'} enabled={enabled.title} onToggle={onToggle} error={errors.title}>
        <input
          id={id('title')}
          type="text"
          autoComplete="off"
          maxLength={MAX_TITLE_LENGTH}
          placeholder="โปรโมชั่นเดือนตุลา"
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id('title')}-error` : undefined}
          className={`input ${errors.title ? INVALID : ''}`}
        />
      </OptionCard>

      <OptionCard idPrefix={idPrefix} name="expiresAt" title="วันหมดอายุ" hint={hints.expiresAt ?? 'หลังจากนั้นลิงก์จะเปิดไม่ได้'} enabled={enabled.expiresAt} onToggle={onToggle} error={errors.expiresAt}>
        <ExpiryInput
          id={id('expiresAt')}
          value={values.expiresAt}
          onChange={(value) => onChange('expiresAt', value)}
          invalid={Boolean(errors.expiresAt)}
          describedBy={errors.expiresAt ? `${id('expiresAt')}-error` : undefined}
        />
      </OptionCard>

      <OptionCard idPrefix={idPrefix} name="maxClicks" title="จำกัดจำนวนคลิก" hint={hints.maxClicks ?? 'ครบแล้วลิงก์จะเปิดไม่ได้'} enabled={enabled.maxClicks} onToggle={onToggle} error={errors.maxClicks}>
        <StepperInput
          id={id('maxClicks')}
          placeholder="100"
          value={values.maxClicks}
          onChange={(value) => onChange('maxClicks', value)}
          invalid={Boolean(errors.maxClicks)}
          describedBy={errors.maxClicks ? `${id('maxClicks')}-error` : undefined}
        />
      </OptionCard>

      <OptionCard idPrefix={idPrefix} name="linkPassword" title="ตั้งรหัสผ่านลิงก์" hint={hints.linkPassword ?? 'ผู้เข้าชมต้องใส่รหัสก่อนเปิดลิงก์'} enabled={enabled.linkPassword} onToggle={onToggle} error={errors.linkPassword}>
        <PasswordInput
          id={id('linkPassword')}
          placeholder={passwordPlaceholder}
          value={values.linkPassword}
          onChange={(value) => onChange('linkPassword', value)}
          onLimit={onPasswordLimit}
          invalid={Boolean(errors.linkPassword)}
          describedBy={errors.linkPassword ? `${id('linkPassword')}-error` : undefined}
        />
      </OptionCard>
    </div>
  );
}

// One option as a horizontal row: [title + hint] [input] [switch].
// The input's space is always reserved, so switching it on never moves the layout; it just
// fades and slides in. `inert` keeps it unfocusable while off. A validation error replaces the
// grey hint text (so it needs no extra height).
function OptionCard({ idPrefix, name, title, hint, enabled, onToggle, error, children }) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl bg-paper px-4 py-3 ring-1 sm:grid-cols-[12rem_1fr_auto] ${enabled ? 'ring-brand/40' : 'ring-transparent'}`}
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {error ? (
          <p id={`${settingsFieldId(idPrefix, name)}-error`} role="alert" className="animate-error-in text-xs font-normal text-brand-dark">{error}</p>
        ) : (
          <p className="text-xs text-neutral-500">{hint}</p>
        )}
      </div>
      <div className="sm:col-start-3 sm:row-start-1">
        <Toggle checked={enabled} onChange={(on) => onToggle(name, on)} label={`${enabled ? 'ปิด' : 'เปิด'} ${title}`} />
      </div>
      <div
        inert={!enabled}
        className={`col-span-2 h-[3.25rem] min-w-0 transition-all duration-300 ease-out sm:col-span-1 sm:col-start-2 sm:row-start-1 ${enabled ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'}`}
      >
        {children}
      </div>
    </div>
  );
}
