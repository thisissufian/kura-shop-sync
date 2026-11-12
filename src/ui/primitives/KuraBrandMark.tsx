export function KuraBrandMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      class="h-9 w-9 shrink-0 rounded-[10px] shadow-xs"
      aria-label="Kura Logo"
    >
      <defs>
        <linearGradient id="kmBg" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="100%" stop-color="#18181B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#kmBg)" />
      <rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1" />
      <rect x="26" y="10" width="12" height="3" rx="1.5" fill="#F8FAFC" />
      <polygon points="32,13 52,25 49,27 15,27 12,25" fill="#475569" />
      <polygon points="32,13 52,25 50,26.5 32,15.5 14,26.5 12,25" fill="#F8FAFC" />
      <path d="M18 26.5 H46 V50 C46 51.8 44.5 53 42.8 53 H21.2 C19.5 53 18 51.8 18 50 Z" fill="#F8FAFC" />
      <rect x="18" y="45" width="28" height="8" rx="1.5" fill="#CBD5E1" opacity="0.6" />
      <rect x="25" y="33" width="14" height="20" rx="3" fill="#0F172A" />
      <circle cx="30" cy="43" r="3.4" fill="none" stroke="#007AFF" stroke-width="1.8" />
      <circle cx="34" cy="43" r="3.4" fill="none" stroke="#34C759" stroke-width="1.8" />
    </svg>
  );
}
