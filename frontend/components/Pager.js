// 1 … 4 5 [6] 7 8 … 20
function pageItems(page, total) {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const items = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) items.push('gap' + n);
    items.push(n);
  });
  return items;
}

export default function Pager({ page, totalPages, onChange }) {
  const base = 'flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium transition-colors';
  return (
    <nav aria-label="หน้าประวัติการคลิก" className="flex items-center gap-1">
      <button type="button" aria-label="หน้าก่อนหน้า" disabled={page === 1} onClick={() => onChange(page - 1)} className={`${base} text-neutral-600 hover:bg-paper disabled:opacity-30`}>
        ‹
      </button>
      {pageItems(page, totalPages).map((item) =>
        typeof item === 'string' ? (
          <span key={item} className="px-1 text-neutral-400">…</span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
            className={`${base} ${item === page ? 'bg-brand text-white' : 'text-neutral-600 hover:bg-paper'}`}
          >
            {item}
          </button>
        ),
      )}
      <button type="button" aria-label="หน้าถัดไป" disabled={page === totalPages} onClick={() => onChange(page + 1)} className={`${base} text-neutral-600 hover:bg-paper disabled:opacity-30`}>
        ›
      </button>
    </nav>
  );
}
