import { signal } from "@preact/signals";
import type { BillReceipt } from "../types/kura";
import { playCheckoutChime, playScanBeep, playWarningTone } from "../ui/utils/posAudio";
import { callBackend } from "./ipcBridge";
import {
  activeReceipt,
  cart,
  clearCart,
  customers,
  discountMinor,
  paymentMode,
  recentBills,
  selectedCustomerId,
  showToast,
} from "./kuraStore";
import { scannerMode } from "./uiSignals";

export interface ParkedCart {
  id: string;
  label: string;
  items: Record<string, number>;
  discountMinor: number;
  customerName?: string;
  customerId?: string;
  parkedAt: string;
}

const STORAGE_KEY = "kura_parked_carts_v1";
export const BILL_NO_RE = /^K\d+-\d{6}-\d{4}$/i;

function loadParked(): ParkedCart[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ParkedCart[]) : [];
  } catch {
    return [];
  }
}

function saveParked(list: ParkedCart[]): void {
  parkedCarts.value = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export const parkedCarts = signal<ParkedCart[]>(loadParked());

function buildSnapshot(customLabel?: string, nextIndex = 1): ParkedCart {
  const cust = customers.value.find((c) => c.customer_id === selectedCustomerId.value);
  return {
    id: `P-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    label: customLabel?.trim() || cust?.name || `Hold #${nextIndex}`,
    items: { ...cart.value },
    discountMinor: discountMinor.value,
    customerName: cust?.name,
    customerId: cust?.customer_id,
    parkedAt: new Date().toISOString(),
  };
}

export function holdCurrentCart(customLabel?: string): boolean {
  if (Object.keys(cart.value).length === 0) {
    showToast("Cart is empty — nothing to hold", "err");
    return false;
  }
  if (parkedCarts.value.length >= 5) {
    showToast("Hold queue full (max 5 parked carts)", "err");
    return false;
  }
  const snap = buildSnapshot(customLabel, parkedCarts.value.length + 1);
  saveParked([...parkedCarts.value, snap]);
  clearCart();
  selectedCustomerId.value = "";
  paymentMode.value = "CASH";
  playScanBeep();
  showToast(`Parked "${snap.label}" (F6)`);
  return true;
}

export function resumeParkedCart(id: string): void {
  const target = parkedCarts.value.find((p) => p.id === id);
  if (!target) return;
  let remaining = parkedCarts.value.filter((p) => p.id !== id);
  if (Object.keys(cart.value).length > 0 && remaining.length < 5) {
    remaining = [...remaining, buildSnapshot(undefined, remaining.length + 1)];
  }
  saveParked(remaining);
  cart.value = { ...target.items };
  discountMinor.value = target.discountMinor;
  selectedCustomerId.value = target.customerId ?? "";
  playScanBeep();
  showToast(`Resumed "${target.label}"`);
}

export function discardParkedCart(id: string): void {
  const next = parkedCarts.value.filter((p) => p.id !== id);
  saveParked(next);
  showToast("Removed parked cart");
}

export async function tryOpenBillByScan(rawCode: string): Promise<boolean> {
  const billNo = rawCode.trim().toUpperCase();
  if (!BILL_NO_RE.test(billNo)) return false;
  let found = recentBills.value.find((b) => b.bill_no.toUpperCase() === billNo) ?? null;
  if (!found) {
    try {
      found = await callBackend<BillReceipt | null>("find_bill_by_no", { billNo });
    } catch {
      found = null;
    }
  }
  if (found) {
    activeReceipt.value = found;
    scannerMode.value = null;
    playCheckoutChime();
    showToast(`Opened Receipt ${found.bill_no}`);
  } else {
    playWarningTone();
    showToast(`Receipt not found: ${billNo}`, "err");
  }
  return true;
}
