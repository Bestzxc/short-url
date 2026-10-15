'use client';

import { INVALID } from './FieldError';

const MIN = 1;
const MAX = 1000000;

// Number field with round − / + buttons on each side; short, centred value
export default function StepperInput({ id, value, onChange, invalid, describedBy, placeholder }) {
  function step(delta) {
    const current = Number(value);
    const base = Number.isFinite(current) && value !== '' ? current : 0;
    onChange(String(Math.min(MAX, Math.max(MIN, Math.trunc(base) + delta))));
  }

  const buttonClass =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl leading-none ring-1 ring-neutral-300 transition-colors hover:bg-brand-soft hover:text-brand-dark hover:ring-brand/40';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-1)} aria-label="ลดจำนวนคลิก" className={buttonClass}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN}
        max={MAX}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`input w-28 px-2 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${invalid ? INVALID : ''}`}
      />
      <button type="button" onClick={() => step(1)} aria-label="เพิ่มจำนวนคลิก" className={buttonClass}>
        +
      </button>
    </div>
  );
}
