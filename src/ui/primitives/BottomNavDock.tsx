import type { JSX } from "preact";
import { activeTab, cartCount, syncStatus } from "../../state/kuraStore";
import { remoteRelayConnected } from "../../state/uiSignals";
import type { KuraTab } from "../../types/kura";
import { IconBox, IconChart, IconHome, IconRegister, IconSyncGrid } from "./KuraIcons";

export const NAV_ITEMS: { id: KuraTab; label: string; long: string; icon: (cls: string) => JSX.Element }[] = [
  { id: "home", label: "Home", long: "Home", icon: (c) => <IconHome class={c} /> },
  { id: "vault", label: "Products", long: "Products", icon: (c) => <IconBox class={c} /> },
  { id: "counter", label: "Register", long: "Register", icon: (c) => <IconRegister class={c} /> },
  { id: "reports", label: "Reports", long: "Reports", icon: (c) => <IconChart class={c} /> },
  { id: "sync", label: "Sync", long: "Sync & More", icon: (c) => <IconSyncGrid class={c} /> },
];

export const isNetworkOnline = () =>
  (syncStatus.value?.peer_count ?? 0) > 0 || remoteRelayConnected.value;

/** iOS tab bar: five equal items, monochrome, tint on the selected one. */
export function BottomNavDock() {
  const current = activeTab.value;
  const count = cartCount.value;
  const online = isNetworkOnline();

  return (
    <nav
      aria-label="Tabs"
      class="lg:hidden fixed bottom-0 inset-x-0 z-40 kura-glass-bar kura-hairline-t kura-safe-bottom"
    >
      <div class="mx-auto flex max-w-lg h-[50px] items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          const badge = item.id === "counter" ? count : 0;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => { activeTab.value = item.id; }}
              class={`flex-1 flex flex-col items-center justify-center gap-[3px] pt-1 transition-colors ${
                active ? "text-tint" : "text-label-2"
              }`}
            >
              <span class="relative">
                {item.icon(`w-[25px] h-[25px] ${active ? "stroke-[2.1]" : ""}`)}
                {badge > 0 && (
                  <span class="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-fill text-white text-[11px] font-semibold leading-[18px] text-center tabular-nums">
                    {badge}
                  </span>
                )}
                {item.id === "sync" && online && (
                  <span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-positive-fill ring-2 ring-[var(--kura-bg-canvas)]" />
                )}
              </span>
              <span class={`text-[10px] leading-3 ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
