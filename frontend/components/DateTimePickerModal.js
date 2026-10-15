'use client';

import { useState } from 'react';
import Modal from './Modal';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const YEARS_AHEAD = 10;
const BUDDHIST_OFFSET = 543;

const pad = (n) => String(n).padStart(2, '0');

// "2026-10-15T14:30" in local time: the value format used by the expiry field
export function toLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function monthName(year, month) {
  return new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long' });
}

function sameDay(a, b) {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

// Calendar + time picker shown in a popup (Thai month names, Buddhist-era years like the rest
// of the app). Only future moments can be picked, because it sets a link's expiry.
export default function DateTimePickerModal({ initialValue, onConfirm, onClose }) {
  // Lazy initial state: the clock is read once when the popup opens, not on every render
  const [now] = useState(() => new Date());
  const [draft] = useState(() => {
    const parsed = initialValue ? new Date(initialValue) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    // Default suggestion: tomorrow at the current time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });

  const [selected, setSelected] = useState({ y: draft.getFullYear(), m: draft.getMonth(), d: draft.getDate() });
  const [view, setView] = useState({ y: draft.getFullYear(), m: draft.getMonth() });
  const [mode, setMode] = useState('days'); // 'days' | 'years'

  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const startOfToday = new Date(today.y, today.m, today.d);

  // Earliest time that can still be picked today: the next whole minute after "now"
  const minToday = (() => {
    const total = now.getHours() * 60 + now.getMinutes() + 1;
    return { h: Math.floor(total / 60), m: total % 60 };
  })();
  const todayIsOver = minToday.h > 23; // after 23:59 there is no time left today

  // On today's date a time before `minToday` is moved up to it; other dates are not limited
  const clampTime = (t, day) => {
    if (!sameDay(day, today)) return t;
    if (t.h < minToday.h) return { h: minToday.h, m: minToday.m };
    if (t.h === minToday.h && t.m < minToday.m) return { h: t.h, m: minToday.m };
    return t;
  };

  const [time, setTime] = useState(() => clampTime({ h: draft.getHours(), m: draft.getMinutes() }, { y: draft.getFullYear(), m: draft.getMonth(), d: draft.getDate() }));
  const onToday = sameDay(selected, today);
  const candidate = new Date(selected.y, selected.m, selected.d, time.h, time.m);
  const isFuture = candidate > now;

  // Hours / minutes step by one. Today they can't go below `minToday` (the ▼ buttons stop there);
  // on any other day they wrap around (23 → 0). Updater form, so fast repeated clicks each count.
  function stepHour(delta) {
    setTime((prev) => {
      const h = onToday ? Math.min(23, Math.max(minToday.h, prev.h + delta)) : (prev.h + delta + 24) % 24;
      return clampTime({ h, m: prev.m }, selected);
    });
  }
  function stepMinute(delta) {
    setTime((prev) => clampTime({ h: prev.h, m: (prev.m + delta + 60) % 60 }, selected));
  }
  const canHourDown = !onToday || time.h > minToday.h;
  const canHourUp = !onToday || time.h < 23;
  const canMinuteDown = !onToday || time.h > minToday.h || time.m > minToday.m;

  const atCurrentMonth = view.y === today.y && view.m === today.m;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const leadingBlanks = new Date(view.y, view.m, 1).getDay();

  function shiftMonth(delta) {
    const next = new Date(view.y, view.m + delta, 1);
    setView({ y: next.getFullYear(), m: next.getMonth() });
  }

  function pickYear(year) {
    // Never show a month that is already in the past
    const month = year === today.y ? Math.max(view.m, today.m) : view.m;
    setView({ y: year, m: month });
    setMode('days');
  }

  const years = Array.from({ length: YEARS_AHEAD + 1 }, (_, i) => today.y + i);

  return (
    <Modal title="เลือกวันและเวลาหมดอายุ" onClose={onClose}>
      <div className="grid gap-5 sm:grid-cols-[1fr_9.5rem]">
        {/* Calendar */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <NavButton label="เดือนก่อนหน้า" disabled={atCurrentMonth || mode === 'years'} onClick={() => shiftMonth(-1)}>‹</NavButton>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'days' ? 'years' : 'days'))}
              aria-label="เลือกปี"
              className="rounded-full px-3 py-1 font-extrabold hover:bg-paper"
            >
              {monthName(view.y, view.m)} {view.y + BUDDHIST_OFFSET} <span className="text-xs text-neutral-400">{mode === 'years' ? '▴' : '▾'}</span>
            </button>
            <NavButton label="เดือนถัดไป" disabled={mode === 'years'} onClick={() => shiftMonth(1)}>›</NavButton>
          </div>

          {mode === 'years' ? (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto" role="listbox" aria-label="เลือกปี">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  role="option"
                  aria-selected={year === view.y}
                  onClick={() => pickYear(year)}
                  className={`rounded-xl py-2.5 font-semibold ${year === view.y ? 'bg-brand text-white' : 'bg-paper hover:bg-brand-soft hover:text-brand-dark'}`}
                >
                  {year + BUDDHIST_OFFSET}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 text-center text-xs font-medium text-neutral-400">
                {WEEKDAYS.map((w) => <span key={w} className="py-1.5">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`${monthName(view.y, view.m)} ${view.y + BUDDHIST_OFFSET}`}>
                {Array.from({ length: leadingBlanks }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = { y: view.y, m: view.m, d: i + 1 };
                  const date = new Date(day.y, day.m, day.d);
                  const isTodayCell = sameDay(day, today);
                  const disabled = date < startOfToday || (isTodayCell && todayIsOver);
                  const isSelected = sameDay(day, selected);
                  return (
                    <button
                      key={day.d}
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      aria-label={date.toLocaleDateString('th-TH', { dateStyle: 'full' })}
                      onClick={() => {
                        setSelected(day);
                        setTime((prev) => clampTime(prev, day));
                      }}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-brand text-white shadow-md shadow-brand/30'
                          : disabled
                            ? 'cursor-not-allowed text-neutral-300'
                            : `hover:bg-brand-soft hover:text-brand-dark ${isTodayCell ? 'text-brand ring-1 ring-brand/40' : ''}`
                      }`}
                    >
                      {day.d}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Time */}
        <div className="border-t border-neutral-100 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p className="mb-3 text-center font-extrabold">เวลา</p>
          <div className="flex justify-center gap-4">
            <TimeColumn label="ชั่วโมง" value={time.h} onStep={stepHour} canUp={canHourUp} canDown={canHourDown} />
            <span className="mt-9 text-2xl font-extrabold text-neutral-300" aria-hidden="true">:</span>
            <TimeColumn label="นาที" value={time.m} onStep={stepMinute} canUp canDown={canMinuteDown} />
          </div>
          {onToday && <p className="mt-3 text-center text-xs text-neutral-500">วันนี้เลือกได้ตั้งแต่ {pad(minToday.h)}:{pad(minToday.m)}</p>}
          <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-center text-sm font-medium">
            {candidate.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
          </p>
        </div>
      </div>

      {!isFuture && <p className="alert-error mt-4">กรุณาเลือกเวลาในอนาคต</p>}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn btn-outline">ยกเลิก</button>
        <button type="button" disabled={!isFuture} onClick={() => onConfirm(toLocalValue(candidate))} className="btn btn-primary px-10">
          ตกลง
        </button>
      </div>
    </Modal>
  );
}

function NavButton({ label, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl leading-none ring-1 ring-neutral-200 transition-colors hover:bg-brand-soft hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

// Big number with an up and a down button. The parent decides what a step does (wrapping,
// limits); a button that can't move any further is disabled.
function TimeColumn({ label, value, onStep, canUp, canDown }) {
  const arrow = 'flex h-9 w-11 items-center justify-center rounded-xl text-sm ring-1 ring-neutral-200 transition-colors hover:bg-brand-soft hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => onStep(1)} disabled={!canUp} aria-label={`เพิ่ม${label}`} className={arrow}>▲</button>
      <span className="w-11 py-1 text-center text-3xl font-extrabold tabular-nums" aria-live="polite">{pad(value)}</span>
      <span className="-mt-1 text-xs text-neutral-500">{label}</span>
      <button type="button" onClick={() => onStep(-1)} disabled={!canDown} aria-label={`ลด${label}`} className={arrow}>▼</button>
    </div>
  );
}
