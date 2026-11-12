import { computed } from "@preact/signals";
import type { CustomerAccount } from "../types/kura";
import { callBackend } from "./ipcBridge";
import { customers, refreshBootstrap, showToast } from "./kuraStore";

export const totalDueMinor = computed(() =>
  customers.value.reduce((acc, c) => acc + Math.max(0, c.balance_due_minor), 0)
);

export async function saveCustomer(
  name: string,
  phone: string,
  customerId?: string | null
): Promise<CustomerAccount | null> {
  try {
    const saved = await callBackend<CustomerAccount>("upsert_customer", {
      customerId: customerId ?? null,
      name,
      phone,
    });
    await refreshBootstrap();
    showToast(`Customer saved: ${saved.name}`);
    return saved;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function settleCustomerDue(
  customerId: string,
  amountMinor: number,
  note = "Payment received"
): Promise<boolean> {
  try {
    const updated = await callBackend<CustomerAccount>("record_customer_payment", {
      customerId,
      amountMinor,
      note,
    });
    await refreshBootstrap();
    showToast(`Recorded payment for ${updated.name}`);
    return true;
  } catch (err) {
    showToast(String(err), "err");
    return false;
  }
}
