import { activeTab, cartCount, isOwner, syncStatus } from "../../state/kuraStore";
import { shopSettingsSheetOpen } from "../../state/uiSignals";
import { isNetworkOnline, NAV_ITEMS } from "./BottomNavDock";
import { KuraBrandMark } from "./KuraBrandMark";

/** iPadOS-style sidebar shown at ≥1024px in place of the tab bar. */
export function SidebarNav() {
  const current = activeTab.value;
  const status = syncStatus.value;
  const count = cartCount.value;

  return (
    <aside class="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[248px] flex-col bg-surface kura-hairline-r px-3 pt-5 pb-4">
      <button
        type="button"
        onClick={() => { if (isOwner.value) shopSettingsSheetOpen.value = true; }}
        title={isOwner.value ? "Shop profile & settings" : undefined}
        class="flex items-center gap-3 px-2 pb-5 text-left"
      >
        <KuraBrandMark />
        <div class="min-w-0">
          <div class="text-headline font-semibold text-label truncate">{status?.shop_name ?? "Kura Store"}</div>
          <div class="text-footnote text-label-2 truncate">Terminal {status?.node_id ?? "K1"}</div>
        </div>
      </button>

      <nav aria-label="Sections" class="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => { activeTab.value = item.id; }}
              class={`flex items-center gap-3 rounded-[10px] px-3 h-11 text-body transition-colors ${
                active ? "bg-tint text-white font-semibold" : "text-label hover:bg-fill"
              }`}
            >
              {item.icon(`w-[22px] h-[22px] ${active ? "text-white" : "text-tint"}`)}
              <span class="flex-1 text-left">{item.long}</span>
              {item.id === "counter" && count > 0 && (
                <span class={`text-subhead tabular-nums ${active ? "text-white/85" : "text-label-2"}`}>{count}</span>
              )}
              {item.id === "sync" && isNetworkOnline() && (
                <span class={`kura-dot ${active ? "text-white" : "text-positive-fill"}`} />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
