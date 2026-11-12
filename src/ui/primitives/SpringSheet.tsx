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
        class="spring-sheet-panel relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] bg-[#F5F5F7] shadow-2xl sm:rounded-[20px] border border-black/[0.08]"
        style={{ transform: "translateY(0)" }}
      >
        <div class="flex flex-col items-center bg-white/90 backdrop-blur-xl px-5 pt-2.5 pb-3 border-b border-black/[0.06]">
          <div class="mb-2.5 h-1 w-10 rounded-full bg-black/15 sm:hidden" />
          <div class="flex w-full items-center justify-between gap-3">
            <div>
              <h2 class="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                {title}
              </h2>
              {subtitle && (
                <p class="text-[12px] text-[#86868B]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              class="rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-medium text-[#1D1D1F] hover:bg-black/[0.1] active:scale-95 transition"
            >
              Done
            </button>
          </div>
        </div>
        <div class="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
