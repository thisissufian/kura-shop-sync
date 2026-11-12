import { customers, formatMoney, showToast } from "../../state/kuraStore";
import type { BillReceipt, SyncChainStatus } from "../../types/kura";

export function formatWhatsAppReceipt(
  bill: BillReceipt,
  settings: SyncChainStatus | null,
  sym: string
): string {
  const shop = settings?.shop_name ?? "Kura Store";
  const footer = settings?.receipt_footer ?? "Thank you for shopping!";
  const dt = bill.hlc.slice(0, 19).replace("T", " ");
  const pad = (l: string, r: string) => `${l.slice(0, 20).padEnd(20)} ${r.padStart(10)}`;

  const lines = [
    `*${shop}*`,
    ...(settings?.shop_subtitle ? [settings.shop_subtitle] : []),
    ...(bill.voided ? ["⚠️ *VOIDED RECEIPT*"] : []),
    "```",
    `Bill: ${bill.bill_no}`,
    `Time: ${dt} UTC`,
    `Pay : ${bill.payment_mode} · Node ${bill.node_id}`,
    "--------------------------------",
    ...bill.items.map((it) =>
      pad(`${it.name.slice(0, 14)} x${it.qty}`, formatMoney(it.line_total_minor, sym))
    ),
    "--------------------------------",
    ...(bill.discount_minor > 0
      ? [pad("Discount", formatMoney(-bill.discount_minor, sym))]
      : []),
    pad("TOTAL", formatMoney(bill.total_minor, sym)),
    "```",
    `_${footer}_`,
  ];
  return lines.join("\n");
}

export async function copyReceiptText(
  bill: BillReceipt,
  settings: SyncChainStatus | null,
  sym: string
): Promise<void> {
  const text = formatWhatsAppReceipt(bill, settings, sym);
  try {
    await navigator.clipboard.writeText(text);
    showToast("Receipt text copied");
  } catch {
    showToast("Clipboard permission unavailable", "err");
  }
}

export function shareReceiptWhatsApp(
  bill: BillReceipt,
  settings: SyncChainStatus | null,
  sym: string,
  phone?: string
): void {
  const text = formatWhatsAppReceipt(bill, settings, sym);
  const linkedPhone =
    phone ??
    (bill.customer_id
      ? customers.value.find((c) => c.customer_id === bill.customer_id)?.phone
      : undefined);
  const digits = (linkedPhone ?? "").replace(/[^\d]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  void navigator.clipboard?.writeText(text).catch(() => {});
  showToast("Opening WhatsApp receipt…");
}
