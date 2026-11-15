import type { ComponentChildren } from "preact";

interface IconProps {
  class?: string;
}

const Svg = ({ class: cls = "w-5 h-5", children }: { class?: string; children: ComponentChildren }) => (
  <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconHome = (p: IconProps) => (
  <Svg class={p.class}><path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5h-4.5v-6h-6v6H4.5A1.5 1.5 0 013 20v-9.5z" /></Svg>
);

export const IconBox = (p: IconProps) => (
  <Svg class={p.class}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></Svg>
);

export const IconRegister = (p: IconProps) => (
  <Svg class={p.class}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 20h10M12 16v4M8 8h2M14 8h2M8 11h2M14 11h2" /></Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg class={p.class}><path d="M3 20h18M6 16v-4M12 16V8M18 16v-9" /></Svg>
);

export const IconSyncGrid = (p: IconProps) => (
  <Svg class={p.class}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg class={p.class}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Svg>
);

export const IconBarcodeScan = (p: IconProps) => (
  <Svg class={p.class}><path d="M4 7V4h3M17 4h3v3M4 17v3h3M17 20h3v-3M8 8v8M12 8v8M16 8v8" /></Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg class={p.class}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconCart = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" />
    <path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L21 7H6" />
  </Svg>
);

export const IconTrendUp = (p: IconProps) => (
  <Svg class={p.class}><path d="M22 7l-8.5 8.5-5-5L2 17M16 7h6v6" /></Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg class={p.class}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 13.5a1 1 0 100 2 1 1 0 000-2z" /></Svg>
);

export const IconUsersDue = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="9" cy="8" r="3.5" /><path d="M3 18.5c0-2.8 2.7-5 6-5s6 2.2 6 5" />
    <path d="M16 7.5a3 3 0 010 5M18.5 17c1.5-.4 2.5-1.5 2.5-3 0-1.8-1.5-3.2-3.5-3.5" />
  </Svg>
);

export const IconTruckSupplier = (p: IconProps) => (
  <Svg class={p.class}>
    <rect x="2" y="6" width="13" height="9" rx="1.5" /><path d="M15 9h4l2 3v3h-6V9z" />
    <circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
  </Svg>
);

export const IconPrinter = (p: IconProps) => (
  <Svg class={p.class}>
    <path d="M6 9V4h12v5M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </Svg>
);

export const IconPdf = (p: IconProps) => (
  <Svg class={p.class}><path d="M14 3v4a1 1 0 001 1h4M6 21h12a2 2 0 002-2V7.5L14.5 2H6a2 2 0 00-2 2v15a2 2 0 002 2z" /></Svg>
);

export const IconShare = (p: IconProps) => (
  <Svg class={p.class}><path d="M4 12v7a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-7M16 6l-4-4-4 4M12 2v13" /></Svg>
);

export const IconEdit = (p: IconProps) => (
  <Svg class={p.class}><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg class={p.class}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg class={p.class}><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg class={p.class}>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg class={p.class}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Svg>
);

export const IconShieldOwner = (p: IconProps) => (
  <Svg class={p.class}><path d="M12 3s8 3.5 8 9.5c0 5-4.5 8.5-8 9.5-3.5-1-8-4.5-8-9.5C4 6.5 12 3 12 3zM9 12l2 2 4-4" /></Svg>
);
