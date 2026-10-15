'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsIcon } from './icons';

// Rough size of the menu (px), only used to decide which side it opens to
const MENU_WIDTH = 176;
const MENU_HEIGHT = 110;

// "…" button that opens a small menu. The menu is rendered into <body> with fixed positioning,
// so the scrolling list it sits in can never clip it.
// items = [{ label, icon, onClick, danger }]
export default function RowMenu({ items, label = 'เมนูเพิ่มเติม' }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null); // style of the open menu: { top|bottom, left|right }

  function toggle() {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const GAP = 8;
    const style = {};
    // Keep the menu on screen: line up with the button's right edge unless there is no room on
    // the left (then its left edge), and open upwards when there is no room below
    if (rect.right >= MENU_WIDTH + GAP) style.right = window.innerWidth - rect.right;
    else style.left = Math.max(GAP, rect.left);
    if (rect.bottom + GAP + MENU_HEIGHT <= window.innerHeight) style.top = rect.bottom + GAP;
    else style.bottom = window.innerHeight - rect.top + GAP;
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
    window.addEventListener('scroll', close, true); // any scrolling container
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [position]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        aria-label={label}
        title={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink ring-1 ring-neutral-300 transition-colors hover:ring-ink aria-expanded:bg-paper"
      >
        <DotsIcon className="h-5 w-5" />
      </button>

      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position}
            className="animate-menu-in fixed z-[70] min-w-44 overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-black/15 ring-1 ring-black/5"
          >
            {items.map(({ label: itemLabel, icon: ItemIcon, onClick, danger }) => (
              <button
                key={itemLabel}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onClick();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${danger ? 'text-brand hover:bg-brand-soft' : 'hover:bg-paper'}`}
              >
                {ItemIcon && <ItemIcon className="h-4 w-4" />}
                {itemLabel}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
