import { computed, signal } from "@preact/signals";
import { playCheckoutChime, playScanBeep, playWarningTone } from "../ui/utils/posAudio";
import type { BillReceipt, BootstrapState, CustomerAccount, KuraTab, PdfExportResult, PrinterSettings, Product, SyncChainStatus, UpsertProductInput } from "../types/kura";
import { callBackend, formatMoney, isTauriRuntime, loadPrinterSettings, parseMoneyInput, PRINTER_STORAGE_KEY } from "./ipcBridge";

export { formatMoney, isTauriRuntime, parseMoneyInput };

export const products = signal<Product[]>([]);
export const recentBills = signal<BillReceipt[]>([]);
export const customers = signal<CustomerAccount[]>([]);
export const selectedCustomerId = signal<string>("");
export const syncStatus = signal<SyncChainStatus | null>(null);
export const cart = signal<Record<string, number>>({});
export const discountMinor = signal<number>(0);
export const paymentMode = signal<"CASH" | "WALLET" | "DUE">("CASH");
export const activeTab = signal<KuraTab>("home");
export const activeReceipt = signal<BillReceipt | null>(null);
export const editingProduct = signal<Product | null>(null);
export const productSheetOpen = signal<boolean>(false);
export const loading = signal<boolean>(true);
export const toastMessage = signal<{ text: string; tone: "ok" | "err" } | null>(null);
export const printerSettings = signal<PrinterSettings>(loadPrinterSettings());

let toastTimer: number | undefined;

export function showToast(text: string, tone: "ok" | "err" = "ok"): void {
  if (tone === "err") playWarningTone();
  toastMessage.value = { text, tone };
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage.value = null;
  }, 3200);
}

export const currencySymbol = computed(() => syncStatus.value?.currency_symbol ?? "$");
export const isOwner = computed(() => (syncStatus.value?.role ?? "OWNER") === "OWNER");

export const cartLines = computed(() => {
  const map = cart.value;
  return products.value
    .filter((p) => (map[p.sku] ?? 0) > 0)
    .map((p) => {
      const qty = map[p.sku];
      return { product: p, qty, lineTotal: p.sell_price_minor * qty };
    });
});

export const cartSubtotalMinor = computed(() =>
  cartLines.value.reduce((acc, l) => acc + l.lineTotal, 0)
);

export const cartTotalMinor = computed(() =>
  Math.max(0, cartSubtotalMinor.value - Math.min(discountMinor.value, cartSubtotalMinor.value))
);

export const cartCount = computed(() =>
  cartLines.value.reduce((acc, l) => acc + l.qty, 0)
);

export function updatePrinterSettings(next: PrinterSettings): void {
  printerSettings.value = next;
  try {
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function setCartQty(sku: string, qty: number): void {
  const prev = cart.value[sku] ?? 0;
  const next = { ...cart.value };
  if (qty <= 0) delete next[sku];
  else next[sku] = qty;
  cart.value = next;
  if (qty > prev) playScanBeep();
}

export function clearCart(): void {
  cart.value = {};
  discountMinor.value = 0;
}

export async function refreshBootstrap(): Promise<void> {
  try {
    const data = await callBackend<BootstrapState>("get_bootstrap_state");
    products.value = data.products;
    recentBills.value = data.recent_bills;
    customers.value = data.customers ?? [];
    syncStatus.value = data.sync_status;
  } catch (err) {
    showToast(String(err), "err");
  } finally {
    loading.value = false;
  }
}

export async function saveProduct(input: UpsertProductInput): Promise<boolean> {
  try {
    await callBackend<Product>("upsert_product", { input });
    await refreshBootstrap();
    showToast(`Saved ${input.name}`);
    return true;
  } catch (err) {
    showToast(String(err), "err");
    return false;
  }
}

export async function adjustProductStock(sku: string, delta: number, reason: string): Promise<void> {
  try {
    const updated = await callBackend<Product>("adjust_stock", { sku, delta, reason });
    products.value = products.value.map((p) => (p.sku === sku ? updated : p));
    showToast(`Stock ${delta > 0 ? `+${delta}` : delta} (${sku})`);
  } catch (err) {
    showToast(String(err), "err");
  }
}

export async function chargeAndIssueBill(): Promise<BillReceipt | null> {
  const items = cartLines.value.map((l) => ({
    sku: l.product.sku,
    qty: l.qty,
    warranty_label: l.product.warranty_label,
  }));
  if (items.length === 0) return null;
  if (paymentMode.value === "DUE" && !selectedCustomerId.value) {
    showToast("Select or add a customer for Customer Due", "err");
    return null;
  }
  const cust = customers.value.find((c) => c.customer_id === selectedCustomerId.value);
  const client_label = cust?.name || "Walk-in Customer";
  const role = syncStatus.value?.role || "OWNER";
  const node = syncStatus.value?.node_id || "K1";
  const cashier_label = `${role === "OWNER" ? "Owner" : "Cashier"} · ${node}`;

  try {
    const receipt = await callBackend<BillReceipt>("issue_bill", {
      input: {
        items,
        discount_minor: discountMinor.value,
        payment_mode: paymentMode.value,
        customer_id: paymentMode.value === "DUE" ? selectedCustomerId.value : null,
        client_label,
        cashier_label,
      },
    });
    clearCart();
    await refreshBootstrap();
    activeReceipt.value = receipt;
    playCheckoutChime();
    showToast(`Issued ${receipt.bill_no}`);
    void import("./remoteRelay").then((m) => m.publishRelayDelta());
    return receipt;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function voidExistingBill(billNo: string): Promise<void> {
  try {
    const updated = await callBackend<BillReceipt>("void_bill", { billNo });
    await refreshBootstrap();
    activeReceipt.value = updated;
    showToast(`Voided ${billNo} & restored stock`);
  } catch (err) {
    showToast(String(err), "err");
  }
}

export async function joinChain(input: string, roleOverride?: string): Promise<void> {
  try {
    await callBackend<SyncChainStatus>("join_sync_chain", {
      input,
      roleOverride: roleOverride ?? null,
    });
    await refreshBootstrap();
    showToast("Linked to Sync Chain");
  } catch (err) {
    showToast(String(err), "err");
  }
}

export async function syncWithPeer(peerIp?: string): Promise<void> {
  try {
    const msg = await callBackend<string>("trigger_peer_sync", { peerIp: peerIp?.trim() ? peerIp.trim() : null });
    await refreshBootstrap();
    showToast(msg);
  } catch (err) {
    showToast(String(err), "err");
  }
}

export async function printThermal(billNo: string): Promise<void> {
  const cfg = printerSettings.value;
  try {
    const msg = await callBackend<string>("print_bill_thermal", { ip: cfg.ip, port: cfg.port, widthMm: cfg.widthMm, billNo });
    showToast(msg);
  } catch (err) {
    showToast(String(err), "err");
  }
}

export async function exportPdf(billNo: string): Promise<PdfExportResult | null> {
  try {
    const res = await callBackend<PdfExportResult>("export_bill_pdf", { billNo });
    showToast(`PDF saved (${(res.size_bytes / 1024).toFixed(1)} KB)`);
    return res;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}
