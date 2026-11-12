import { signal } from "@preact/signals";
import type { CashDrawerSummary, ShopExpense } from "../types/kura";
import { callBackend } from "./ipcBridge";
import { showToast } from "./kuraStore";

export const cashDrawerSummary = signal<CashDrawerSummary | null>(null);
export const drawerLoading = signal<boolean>(false);

export async function refreshCashDrawer(): Promise<void> {
  drawerLoading.value = true;
  try {
    cashDrawerSummary.value = await callBackend<CashDrawerSummary>("get_cash_drawer_summary");
  } catch (err) {
    showToast(String(err), "err");
  } finally {
    drawerLoading.value = false;
  }
}

export async function logShopExpense(
  category: string,
  amountMinor: number,
  note: string
): Promise<ShopExpense | null> {
  if (!category.trim() || amountMinor <= 0) {
    showToast("Category and positive amount required", "err");
    return null;
  }
  try {
    const exp = await callBackend<ShopExpense>("log_shop_expense", {
      category: category.trim(),
      amountMinor,
      note: note.trim(),
    });
    await refreshCashDrawer();
    showToast(`Logged ${exp.category} expense`);
    void import("./remoteRelay").then((m) => m.publishRelayDelta());
    return exp;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}
