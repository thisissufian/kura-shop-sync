import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { IconXmark } from "./KuraIcons";

interface SpringSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function SpringSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: SpringSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div class="spring-sheet-scrim fixed inset-0 bg-black/40" onClick={onClose} />
      <div class="spring-sheet-panel kura-elevated relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-sheet bg-sheet text-label shadow-2xl sm:rounded-sheet">
        <div class="relative shrink-0 px-14 pt-2 pb-3 text-center">
          <div class="mx-auto mb-2 h-[5px] w-9 rounded-full bg-label-3 sm:hidden" />
          <h2 class="text-headline font-semibold text-label truncate sm:pt-2">{title}</h2>
          {subtitle && <p class="text-footnote text-label-2 truncate">{subtitle}</p>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            class="kura-icon-btn absolute right-4 top-4 !w-[30px] !h-[30px] !text-label-2"
          >
            <IconXmark class="w-4 h-4 stroke-[2.4]" />
          </button>
        </div>
        <div class="overflow-y-auto px-4 pt-1 pb-6 kura-safe-bottom">{children}</div>
      </div>
    </div>
  );
}
