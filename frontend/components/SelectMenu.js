'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronIcon } from './icons';

const MENU_WIDTH = 272;

// Toolbar dropdown: [icon] prefix  VALUE  ⌄  — opens a radio list (one choice) and, optionally,
// extra rows under a divider (`footer`, a function that receives `close`). The menu is rendered
// into <body> with fixed positioning so a scrolling list can never clip it.
//   options  [{ key, label, short?, count? }]  `short` is the text shown on the button itself
//   active   highlights the button (e.g. a filter that is not "all")
export default function SelectMenu({ icon: Icon, prefix, label, options, value, onChange, active = false, footer, heading, className = '' }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null); // style of the open menu

  const selected = options.find((o) => o.key === value);

  function toggle() {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const GAP = 8;
    const style = { top: rect.bottom + GAP };
    // Line up with the button's left edge; if that would run off the right of the screen use its right edge
    if (rect.left + MENU_WIDTH + GAP <= window.innerWidth) style.left = rect.left;
    else style.right = Math.max(GAP, window.innerWidth - rect.right);
    setPosition(style);
  }

  useEffect(() => {
    if (!position) return undefined;
    const close = () => setPosition(null);
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [position]);

  const itemClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        className={`flex h-[3.1rem] shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm ring-1 transition-colors hover:ring-ink aria-expanded:bg-paper ${active ? 'ring-brand' : 'ring-neutral-300'} ${className}`}
      >
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand' : 'text-neutral-500'}`} />}
        {prefix && <span className="whitespace-nowrap text-neutral-500">{prefix}</span>}
        <span className={`flex-1 whitespace-nowrap text-left font-semibold ${active ? 'text-brand' : ''}`}>{selected?.short ?? selected?.label}</span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${position ? 'rotate-180' : ''}`} />
      </button>

      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{ ...position, width: MENU_WIDTH }}
            className="animate-menu-in fixed z-[70] rounded-2xl bg-white p-2 shadow-xl shadow-black/15 ring-1 ring-black/5"
          >
            {heading && <p className="px-3 pb-1 pt-1.5 text-xs font-semibold tracking-wide text-neutral-400">{heading}</p>}
            {options.map(({ key, label: optionLabel, count }) => {
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onChange(key);
                    setPosition(null);
                  }}
                  className={itemClass}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-brand' : 'border-neutral-300'}`}
                    aria-hidden="true"
                  >
                    {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                  </span>
                  <span className={`flex-1 ${isSelected ? 'font-semibold' : ''}`}>{optionLabel}</span>
                  {count !== undefined && <span className="text-sm text-neutral-400">{count}</span>}
                </button>
              );
            })}
            {footer && (
              <>
                <div className="my-1.5 border-t border-neutral-100" />
                {footer({ close: () => setPosition(null), itemClass })}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
