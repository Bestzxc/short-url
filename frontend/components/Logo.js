import Link from 'next/link';

export default function Logo({ href = '/', light = false }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Short URL หน้าแรก">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/30">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
      </span>
      <span className="leading-none">
        <span className={`block text-2xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
          SHORT<span className="text-brand">URL</span>
        </span>
        <span className={`mt-0.5 block text-[9px] font-medium tracking-[0.35em] ${light ? 'text-white/60' : 'text-neutral-500'}`}>
          LINK · QR · STATS
        </span>
      </span>
    </Link>
  );
}
