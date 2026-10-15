// Small stroke icons (24x24, inherit the text colour)
function Icon({ children, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="12" rx="2.5" />
    <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v8A2.5 2.5 0 0 0 6.5 17H9" />
  </Icon>
);

export const QrIcon = (p) => (
  <Icon {...p}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
    <rect x="8" y="8" width="3" height="3" />
    <rect x="13" y="8" width="3" height="3" />
    <rect x="8" y="13" width="3" height="3" />
    <path d="M13.5 13.5h2.5v2.5" />
  </Icon>
);

export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M5 20V12M12 20V5M19 20v-5" />
  </Icon>
);

export const DotsIcon = (p) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
);

export const EditIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />
  </Icon>
);

export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
  </Icon>
);

export const LockIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const FunnelIcon = (p) => (
  <Icon {...p}>
    <path d="M3 4.5h18l-7 8.5v6l-4 2v-8L3 4.5z" />
  </Icon>
);

export const CalendarIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </Icon>
);

export const ClickIcon = (p) => (
  <Icon {...p}>
    <path d="M9 9l11 4.5-4.8 1.7-1.7 4.8L9 9z" />
    <path d="M6 3.5L7 6M3.5 6L6 7M12 3v2.5M3 12h2.5" />
  </Icon>
);

export const LinkIcon = (p) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </Icon>
);

export const TrendIcon = (p) => (
  <Icon {...p}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);

export const TrophyIcon = (p) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5a1 1 0 0 0-1 1 4 4 0 0 0 4.5 4M16 6h3.5a1 1 0 0 1 1 1 4 4 0 0 1-4.5 4M12 13v4M8.5 20.5h7M10 17h4" />
  </Icon>
);

export const ChevronIcon = (p) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const SortIcon = (p) => (
  <Icon {...p}>
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </Icon>
);

export const RefreshIcon = (p) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
  </Icon>
);
