import { signal } from "@preact/signals";
import type { StockPurchaseInput, SupplierAccount } from "../types/kura";
import { callBackend } from "./ipcBridge";
import { refreshBootstrap, showToast } from "./kuraStore";

export const suppliers = signal<SupplierAccount[]>([]);
export const supplierLoading = signal<boolean>(false);

export async function refreshSuppliers(): Promise<void> {
  supplierLoading.value = true;
  try {
    suppliers.value = await callBackend<SupplierAccount[]>("get_suppliers");
  } catch (err) {
    showToast(String(err), "err");
  } finally {
    supplierLoading.value = false;
  }
}

export async function recordStockPurchase(
  input: StockPurchaseInput
): Promise<SupplierAccount | null> {
  try {
    const res = await callBackend<SupplierAccount>("record_stock_purchase", { input });
    await refreshSuppliers();
    await refreshBootstrap();
    showToast(`Purchased ${input.qty}x ${input.sku} from ${res.name}`);
    void import("./remoteRelay").then((m) => m.publishRelayDelta());
    return res;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function recordSupplierPayment(
  supplierId: string,
  amountMinor: number,
  note: string
): Promise<SupplierAccount | null> {
  if (amountMinor <= 0) {
    showToast("Payment amount must be positive", "err");
    return null;
  }
  try {
    const res = await callBackend<SupplierAccount>("record_supplier_payment", {
      supplierId,
      amountMinor,
      note,
    });
    await refreshSuppliers();
    showToast(`Paid to ${res.name}`);
    void import("./remoteRelay").then((m) => m.publishRelayDelta());
    return res;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}
