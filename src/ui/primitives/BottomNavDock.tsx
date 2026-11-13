import { activeTab, cartCount } from "../../state/kuraStore";
import type { KuraTab } from "../../types/kura";

interface DockItem {
  id: KuraTab;
  label: string;
  icon: string;
}

const LEFT_ITEMS: DockItem[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "vault", label: "Products", icon: "❖" },
];

const RIGHT_ITEMS: DockItem[] = [
  { id: "reports", label: "Reports", icon: "◐" },
  { id: "sync", label: "Sync & More", icon: "⚙" },
];

export function BottomNavDock() {
  const current = activeTab.value;
  const count = cartCount.value;

  return (
    <nav
      aria-label="Bottom Navigation"
      class="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] kura-safe-bottom"
    >
      <div class="max-w-md mx-auto px-4 h-16 flex items-center justify-between relative">
        {/* Left 2 items */}
        <div class="flex items-center gap-1 flex-1 justify-around">
          {LEFT_ITEMS.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  activeTab.value = item.id;
                }}
                class={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
                  active
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                <span class="text-[19px] leading-none mb-1">{item.icon}</span>
                <span class="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center elevated Register / Counter Button */}
        <div class="relative -top-3 shrink-0 mx-2">
          <button
            type="button"
            onClick={() => {
              activeTab.value = "counter";
            }}
            class={`relative flex items-center gap-1.5 px-4 h-13 rounded-full shadow-[0_8px_20px_rgba(0,122,255,0.35)] transition transform active:scale-95 ${
              current === "counter"
                ? "bg-gradient-to-r from-[#007AFF] to-[#34C759] text-white ring-2 ring-white/40"
                : "bg-[#007AFF] hover:bg-[#0062CC] text-white"
            }`}
          >
            <span class="text-[18px]">⚡</span>
            <span class="text-[13px] font-bold tracking-tight">Register</span>
            {count > 0 && (
              <span class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-black tabular-nums shadow-xs">
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Right 2 items */}
        <div class="flex items-center gap-1 flex-1 justify-around">
          {RIGHT_ITEMS.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  activeTab.value = item.id;
                }}
                class={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
                  active
                    ? "text-[#007AFF] font-semibold"
                    : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                <span class="text-[19px] leading-none mb-1">{item.icon}</span>
                <span class="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
