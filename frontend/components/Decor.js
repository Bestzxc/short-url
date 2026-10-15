// Background accents: soft diagonal panel and thin sweeping curve with a dot grid
export default function Decor() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-40 top-0 h-[520px] w-[620px] -skew-x-12 bg-white/70" />
      <svg className="absolute -bottom-10 right-0 h-[420px] w-[620px] text-neutral-300" viewBox="0 0 620 420" fill="none">
        <path d="M0 420 C 180 420, 240 120, 420 110 S 620 160, 640 150" stroke="currentColor" strokeWidth="1.5" />
        <path d="M60 420 C 230 410, 300 170, 470 160 S 620 200, 640 195" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      </svg>
      <svg className="absolute bottom-10 right-10 hidden h-28 w-28 text-neutral-300 md:block" viewBox="0 0 112 112">
        {Array.from({ length: 36 }, (_, i) => (
          <circle key={i} cx={8 + (i % 6) * 19} cy={8 + Math.floor(i / 6) * 19} r="1.6" fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}
