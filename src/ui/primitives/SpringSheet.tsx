import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

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
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div
        class="spring-sheet-panel relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] kura-canvas shadow-2xl sm:rounded-2xl border border-black/[0.08] dark:border-white/[0.1]"
        style={{ transform: "translateY(0)" }}
      >
        <div class="flex flex-col items-center kura-glass-bar px-5 pt-2.5 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div class="mb-2.5 h-1 w-10 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" />
          <div class="flex w-full items-center justify-between gap-3">
            <div>
              <h2 class="text-[17px] font-semibold tracking-tight kura-text-main">
                {title}
              </h2>
              {subtitle && (
                <p class="text-[12px] kura-text-muted">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              class="rounded-full kura-subtle px-3 py-1.5 text-[13px] font-medium kura-text-main hover:brightness-110 active:scale-95 transition"
            >
              Done
            </button>
          </div>
        </div>
        <div class="overflow-y-auto px-4 pt-4 sm:px-5 sm:pt-5 kura-safe-bottom">{children}</div>
      </div>
    </div>
  );
}
