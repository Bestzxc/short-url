'use client';

import { useCallback, useState } from 'react';
import { formatNumber } from '@/lib/format';

// Line chart of clicks per day, drawn as SVG (no chart library). data = [{ day: 'YYYY-MM-DD', clicks }]
// The chart is drawn at the real width of its box (re-measured on resize), so labels keep the same
// size on every screen instead of shrinking with a scaled-down picture.
const DEFAULT_WIDTH = 640;
const MIN_WIDTH = 260;
const M = { top: 16, right: 16, bottom: 34, left: 44 };
const TICKS = 4;
const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']; // index = Date#getDay()

// A "nice" step so the axis ends on a round number (…, 1, 2, 5, 10, 20, 50, …)
function niceStep(max) {
  if (max <= 0) return 1;
  const rough = max / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const factor = [1, 2, 2.5, 5, 10].find((f) => f * magnitude >= rough);
  return Math.max(1, factor * magnitude);
}

// 'YYYY-MM-DD' as a local date (never via Date.parse of the bare string, which would be UTC)
function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

// unit 'month': keys are 'YYYY-MM' (one point per month); height: fixed chart height in px
export default function LineChart({ data, unit = 'day', height }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [hover, setHover] = useState(null);

  // Callback ref: measures the box as soon as it is attached (so the first paint is already the
  // right size), then keeps following it. The returned function stops watching on unmount.
  const boxRef = useCallback((box) => {
    if (!box) return undefined;
    const update = () => setWidth(Math.max(MIN_WIDTH, Math.round(box.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const W = width;
  const H = height ?? Math.min(280, Math.max(200, Math.round(W * 0.42)));
  const PLOT_W = W - M.left - M.right;
  const PLOT_H = H - M.top - M.bottom;
  const n = data.length;
  const total = data.reduce((sum, d) => sum + d.clicks, 0);
  const step = niceStep(Math.max(...data.map((d) => d.clicks), 0));
  const yMax = step * TICKS;

  const x = (i) => M.left + (n === 1 ? PLOT_W / 2 : (i * PLOT_W) / (n - 1));
  const y = (v) => M.top + PLOT_H - (v / yMax) * PLOT_H;
  const points = data.map((d, i) => [x(i), y(d.clicks)]);
  const line = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  const monthly = unit === 'month';
  // Weekday letters for a week; every 5th date for a month
  const weekly = n <= 7 && unit !== 'month';
  // On a narrow screen a month shows every 10th date so the labels never touch
  const monthStep = monthly ? Math.ceil(n / 6) : W < 420 ? 10 : 5;
  const labelAt = (i) => (weekly ? true : i % monthStep === 0 || (i === n - 1 && (n - 1) % monthStep >= monthStep / 2));
  const labelText = (d) =>
    monthly
      ? parseDay(d.day).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
      : weekly ? WEEKDAYS[parseDay(d.day).getDay()] : parseDay(d.day).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  const colWidth = n === 1 ? PLOT_W : PLOT_W / (n - 1);
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div ref={boxRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block max-w-full text-brand"
        role="img"
        aria-label={`กราฟเส้นแสดงจำนวนคลิกต่อวัน ${n} วัน รวม ${formatNumber(total)} คลิก`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="clicks-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid + y axis */}
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const value = i * step;
          return (
            <g key={i}>
              <line x1={M.left} x2={W - M.right} y1={y(value)} y2={y(value)} className="stroke-neutral-200" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={M.left - 8} y={y(value) + 4} textAnchor="end" className="fill-neutral-500" fontSize="11">{formatNumber(value)}</text>
            </g>
          );
        })}

        {/* x axis labels */}
        {data.map((d, i) =>
          labelAt(i) ? (
            <text key={d.day} x={x(i)} y={H - 10} textAnchor="middle" className="fill-neutral-500" fontSize="11">
              {labelText(d)}
            </text>
          ) : null,
        )}

        {total > 0 && <path d={area} fill="url(#clicks-area)" />}
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* dots (bigger for the hovered day) */}
        {points.map(([px, py], i) => (
          <circle key={data[i].day} cx={px} cy={py} r={hover === i ? 6 : weekly ? 4 : 2.5} className="fill-white" stroke="currentColor" strokeWidth="2.5" />
        ))}

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={y(0)} className="stroke-neutral-300" strokeWidth="1" />}

        {/* invisible columns that catch the pointer */}
        {data.map((d, i) => (
          <rect
            key={d.day}
            x={x(i) - colWidth / 2}
            y={M.top}
            width={colWidth}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-1.5 text-center text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hovered.clicks) / H) * 100}%`, marginTop: -10 }}
        >
          <p className="text-white/70">{parseDay(hovered.day).toLocaleDateString('th-TH', monthly ? { month: 'long', year: 'numeric' } : { dateStyle: 'medium' })}</p>
          <p className="font-bold">{formatNumber(hovered.clicks)} คลิก</p>
        </div>
      )}
    </div>
  );
}
