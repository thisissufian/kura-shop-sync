import { activeTab, cartCount, products, syncStatus } from "../../state/kuraStore";
import { remoteRelayConnected } from "../../state/uiSignals";
import type { KuraTab } from "../../types/kura";
import {
  IconBox,
  IconChart,
  IconHome,
  IconRegister,
  IconSyncGrid,
} from "./KuraIcons";

export function BottomNavDock() {
  const current = activeTab.value;
  const count = cartCount.value;
  const skuCount = products.value.length;
  const isOnline = (syncStatus.value?.peer_count ?? 0) > 0 || remoteRelayConnected.value;

  const navBtn = (id: KuraTab, label: string, icon: preact.JSX.Element, badge?: number) => {
    const active = current === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => { activeTab.value = id; }}
        class={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition kura-btn-press ${
          active ? "text-[#007AFF] font-bold" : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
        }`}
      >
        <div class="relative">
          {icon}
          {Boolean(badge && badge > 0) && (
            <span class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#007AFF]/15 text-[#007AFF] text-[9px] font-bold flex items-center justify-center tabular-nums">
              {badge}
            </span>
          )}
        </div>
        <span class="text-[10px] tracking-tight mt-1">{label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Bottom Navigation"
      class="fixed bottom-0 inset-x-0 z-40 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-2xl border-t border-black/[0.06] dark:border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] kura-safe-bottom"
    >
      <div class="max-w-md mx-auto px-3 h-16 flex items-center justify-between relative">
        <div class="flex items-center gap-1 flex-1 justify-around">
          {navBtn("home", "Home", <IconHome class="w-5 h-5" />)}
          {navBtn("vault", "Products", <IconBox class="w-5 h-5" />, skuCount)}
        </div>

        {/* Elevated Center POS Register Squircle */}
        <div class="relative -top-3.5 shrink-0 mx-2">
          <button
            type="button"
            onClick={() => { activeTab.value = "counter"; }}
            title="Open Register (POS Till)"
            class={`relative w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg transition kura-btn-press ${
              current === "counter"
                ? "bg-gradient-to-br from-[#007AFF] to-[#34C759] ring-2 ring-white/50"
                : "bg-gradient-to-br from-[#007AFF] to-[#0055D4]"
            }`}
          >
            <IconRegister class="w-6 h-6 stroke-[2]" />
            <span class="text-[9px] font-bold tracking-tight uppercase leading-none mt-0.5">Till</span>
            {count > 0 && (
              <span class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-black flex items-center justify-center tabular-nums shadow-sm ring-2 ring-white dark:ring-[#1C1C1E]">
                {count}
              </span>
            )}
          </button>
        </div>

        <div class="flex items-center gap-1 flex-1 justify-around">
          {navBtn("reports", "Reports", <IconChart class="w-5 h-5" />)}
          <button
            type="button"
            onClick={() => { activeTab.value = "sync"; }}
            class={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition kura-btn-press ${
              current === "sync" ? "text-[#007AFF] font-bold" : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            }`}
          >
            <div class="relative">
              <IconSyncGrid class="w-5 h-5" />
              {isOnline && (
                <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#34C759] ring-2 ring-white dark:ring-[#1C1C1E] animate-pulse" />
              )}
            </div>
            <span class="text-[10px] tracking-tight mt-1">Sync</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
