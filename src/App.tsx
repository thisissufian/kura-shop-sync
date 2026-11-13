import { useEffect } from "preact/hooks";
import {
  activeTab,
  cartCount,
  currencySymbol,
  formatMoney,
  isOwner,
  isTauriRuntime,
  loading,
  refreshBootstrap,
  syncStatus,
  toastMessage,
} from "./state/kuraStore";
import { totalDueMinor } from "./state/customerActions";
import { initRelaySettings } from "./state/remoteRelay";
import { cycleThemeMode, initThemeListener, themeMode } from "./state/themeStore";
import { drawerSheetOpen, khataSheetOpen, remoteRelayConnected, shopSettingsSheetOpen } from "./state/uiSignals";
import type { KuraTab } from "./types/kura";
import { BottomNavDock } from "./ui/primitives/BottomNavDock";
import { KuraBrandMark } from "./ui/primitives/KuraBrandMark";
import { SegmentedControl } from "./ui/primitives/SegmentedControl";
import { CashDrawerSheet } from "./ui/sheets/CashDrawerSheet";
import { CsvCatalogSheet } from "./ui/sheets/CsvCatalogSheet";
import { CustomerKhataSheet } from "./ui/sheets/CustomerKhataSheet";
import { ProductFormSheet } from "./ui/sheets/ProductFormSheet";
import { ReceiptSheet } from "./ui/sheets/ReceiptSheet";
import { ScannerSheet } from "./ui/sheets/ScannerSheet";
import { ShopSettingsSheet } from "./ui/sheets/ShopSettingsSheet";
import { SupplierPayablesSheet } from "./ui/sheets/SupplierPayablesSheet";
import { audioMuted, toggleAudioMute } from "./ui/utils/posAudio";
import { attachPosHotkeys } from "./ui/utils/posHotkeys";
import { CounterView } from "./ui/views/CounterView";
import { HomeDashboardView } from "./ui/views/HomeDashboardView";
import { KuraVaultView } from "./ui/views/KuraVaultView";
import { ReportsAnalyticsView } from "./ui/views/ReportsAnalyticsView";
import { SyncAndPrintView } from "./ui/views/SyncAndPrintView";

export function App() {
  useEffect(() => {
    void refreshBootstrap();
    initRelaySettings();
    const stopTheme = initThemeListener();
    const stopKeys = attachPosHotkeys();
    return () => {
      stopTheme();
      stopKeys();
    };
  }, []);

  const status = syncStatus.value;
  const tab = activeTab.value;
  const toast = toastMessage.value;

  const toggleRole = () => {
    if (!syncStatus.value) return;
    const nextRole = syncStatus.value.role === "OWNER" ? "CASHIER" : "OWNER";
    syncStatus.value = { ...syncStatus.value, role: nextRole };
  };

  const tabs: { id: KuraTab; label: string; badge?: number }[] = [
    { id: "home", label: "Home" },
    { id: "vault", label: "Products" },
    { id: "counter", label: "Register", badge: cartCount.value },
    { id: "reports", label: "Reports" },
    { id: "sync", label: "Sync & More" },
  ];

  return (
    <div class="min-h-screen bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-200">
      <header class="sticky top-0 z-20 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] kura-safe-top">
        <div class="mx-auto max-w-5xl px-4 pb-2.5 space-y-2.5">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <KuraBrandMark />
              <div class="min-w-0">
                <h1 class="truncate text-[16px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {status?.shop_name ?? "Kura"}
                </h1>
                <div class="flex items-center gap-1.5 text-[11px] text-[#86868B] tabular-nums">
                  <span class={`h-1.5 w-1.5 rounded-full ${(status?.peer_count ?? 0) > 0 ? "bg-[#34C759]" : "bg-[#007AFF]"}`} />
                  <span>{status?.node_id ?? "K1"}</span>
                  <button
                    type="button"
                    onClick={toggleRole}
                    title="Tap to toggle Owner / Cashier preview mode"
                    class={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                      status?.role === "OWNER"
                        ? "bg-[#007AFF]/12 text-[#007AFF]"
                        : "bg-[#FF9500]/14 text-[#B25E00] dark:text-[#FF9500]"
                    }`}
                  >
                    ● {status?.role === "OWNER" ? "Owner ⇄" : "Cashier ⇄"}
                  </button>
                  {remoteRelayConnected.value && (
                    <span class="rounded-full bg-[#34C759]/14 px-1.5 py-0.2 text-[10px] font-semibold text-[#1E8E3E] dark:text-[#34C759]">
                      Remote Live
                    </span>
                  )}
                  {!isTauriRuntime && (
                    <span class="rounded bg-black/[0.06] dark:bg-white/[0.08] px-1.5 py-0.2 text-[10px]">
                      Preview
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { khataSheetOpen.value = true; }}
                title="Customer Due / Khata Ledger"
                class="rounded-full bg-[#FF9500]/14 px-2.5 py-1 text-[11px] font-semibold text-[#B25E00] dark:text-[#FF9500] tabular-nums hover:bg-[#FF9500]/22"
              >
                Due {formatMoney(totalDueMinor.value, currencySymbol.value)}
              </button>
              <button
                type="button"
                onClick={() => { drawerSheetOpen.value = true; }}
                title="Cash Drawer & Petty Expenses"
                class="rounded-full bg-[#34C759]/14 px-2.5 py-1 text-[11px] font-semibold text-[#1E8E3E] dark:text-[#34C759] hover:bg-[#34C759]/22"
              >
                Till
              </button>
              {isOwner.value && (
                <button
                  type="button"
                  onClick={() => { shopSettingsSheetOpen.value = true; }}
                  title="Shop Profile & Currency"
                  class="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium hover:bg-black/[0.09]"
                >
                  Shop
                </button>
              )}
              <button
                type="button"
                onClick={toggleAudioMute}
                title={audioMuted.value ? "Unmute POS audio" : "Mute POS audio"}
                class="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F]"
              >
                {audioMuted.value ? "Muted" : "Sound"}
              </button>
              <button
                type="button"
                onClick={cycleThemeMode}
                title={`Theme: ${themeMode.value} (tap to cycle)`}
                class="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium hover:bg-black/[0.09]"
              >
                {themeMode.value === "DARK" ? "🌙 OLED" : themeMode.value === "LIGHT" ? "☀️ Light" : "🌗 Auto"}
              </button>
            </div>
          </div>

          <div class="hidden sm:block">
            <SegmentedControl
              options={tabs}
              value={tab}
              onChange={(next) => { activeTab.value = next; }}
            />
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 pt-4">
        {loading.value ? (
          <div class="py-20 text-center text-[14px] text-[#86868B]">
            Loading Kura Store…
          </div>
        ) : tab === "home" ? (
          <HomeDashboardView />
        ) : tab === "vault" ? (
          <KuraVaultView />
        ) : tab === "counter" ? (
          <CounterView />
        ) : tab === "reports" ? (
          <ReportsAnalyticsView />
        ) : (
          <SyncAndPrintView />
        )}
      </main>

      <BottomNavDock />

      {toast && (
        <div class="fixed top-4 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
          <div
            class={`rounded-full px-4 py-2 text-[13px] font-medium text-white shadow-lg ${
              toast.tone === "err" ? "bg-[#FF3B30]" : "bg-[#1D1D1F]/90 backdrop-blur-md"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <ReceiptSheet />
      <ProductFormSheet />
      <ScannerSheet />
      <ShopSettingsSheet />
      <CustomerKhataSheet />
      <SupplierPayablesSheet />
      <CashDrawerSheet />
      <CsvCatalogSheet />
    </div>
  );
}
