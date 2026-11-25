import { useEffect } from "preact/hooks";
import { activeTab, loading, refreshBootstrap, toastMessage } from "./state/kuraStore";
import { initRelaySettings } from "./state/remoteRelay";
import { initThemeListener } from "./state/themeStore";
import { BottomNavDock } from "./ui/primitives/BottomNavDock";
import { SidebarNav } from "./ui/primitives/SidebarNav";
import { TopBar } from "./ui/components/TopBar";
import { CashDrawerSheet } from "./ui/sheets/CashDrawerSheet";
import { CsvCatalogSheet } from "./ui/sheets/CsvCatalogSheet";
import { CustomerKhataSheet } from "./ui/sheets/CustomerKhataSheet";
import { ProductFormSheet } from "./ui/sheets/ProductFormSheet";
import { ReceiptSheet } from "./ui/sheets/ReceiptSheet";
import { ScannerSheet } from "./ui/sheets/ScannerSheet";
import { ShopSettingsSheet } from "./ui/sheets/ShopSettingsSheet";
import { SupplierPayablesSheet } from "./ui/sheets/SupplierPayablesSheet";
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

  const tab = activeTab.value;
  const toast = toastMessage.value;

  return (
    <div class="kura-canvas min-h-screen lg:pl-[248px]">
      <SidebarNav />
      <TopBar />

      <main class="mx-auto max-w-5xl px-4 pt-3 pb-32 lg:px-8 lg:pb-12">
        {loading.value ? (
          <div class="py-24 text-center text-subhead text-label-2">
            Loading…
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
        <div class="fixed top-[calc(env(safe-area-inset-top)+60px)] left-1/2 z-[60] -translate-x-1/2 pointer-events-none w-max max-w-[calc(100vw-32px)]" role="status">
          <div
            class={`spring-sheet-scrim flex items-center gap-2 rounded-full kura-glass-bar px-4 py-2.5 text-subhead font-medium text-label shadow-[0_8px_32px_rgba(0,0,0,0.16)] ${
              toast.tone === "err" ? "!text-danger" : ""
            }`}
          >
            {toast.tone === "err" && <span class="kura-dot text-danger-fill" />}
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
