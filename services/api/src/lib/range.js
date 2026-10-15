// Helpers for "the last N days" / "month by month" in the VIEWER's time zone.
// tzOffset is the browser's getTimezoneOffset() in minutes (Thailand = -420), so a "day" means
// the user's own calendar day, not a UTC day.

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTzOffset(value) {
  const tz = Number(value);
  return Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;
}

// The last `days` local days, today included.
//   since  the real UTC moment the range starts (use it in `clicked_at >= ?`)
//   keys   'YYYY-MM-DD' for every day of the range, oldest first
function dayRange(days, tzOffset) {
  const localNow = new Date(Date.now() - tzOffset * 60 * 1000);
  const todayMidnight = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
  const first = todayMidnight - (days - 1) * DAY_MS;
  const keys = Array.from({ length: days }, (_, i) => new Date(first + i * DAY_MS).toISOString().slice(0, 10));
  return { since: new Date(first + tzOffset * 60 * 1000), keys };
}

// Month by month from the month `startDate` falls in up to the current month, at most `max` months.
//   since  the real UTC moment the first month starts
//   keys   'YYYY-MM' for every month, oldest first
function monthRange(startDate, tzOffset, max = 24) {
  const toLocal = (date) => new Date(date.getTime() - tzOffset * 60 * 1000);
  const start = toLocal(startDate);
  const now = toLocal(new Date());
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const keys = [];
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m <= now.getUTCMonth())) {
    keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  const kept = keys.slice(-max);
  const [fy, fm] = kept[0].split('-').map(Number);
  return { since: new Date(Date.UTC(fy, fm - 1, 1) + tzOffset * 60 * 1000), keys: kept };
}

module.exports = { parseTzOffset, dayRange, monthRange };
