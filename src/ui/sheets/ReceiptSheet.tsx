import { useEffect, useState } from "preact/hooks";
import {
  activeReceipt,
  currencySymbol,
  exportPdf,
  formatMoney,
  isOwner,
  printerSettings,
  printThermal,
  syncStatus,
  voidExistingBill,
} from "../../state/kuraStore";
import type { PdfExportResult } from "../../types/kura";
import { SpringSheet } from "../primitives/SpringSheet";
import { copyReceiptText, shareReceiptWhatsApp } from "../utils/whatsappReceipt";

export function ReceiptSheet() {
  const bill = activeReceipt.value;
  const [pdfResult, setPdfResult] = useState<PdfExportResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPdfResult(null);
  }, [bill?.bill_no]);

  if (!bill) return null;
  const sym = currencySymbol.value;
  const cfg = printerSettings.value;

  const handlePrint = async () => {
    setBusy(true);
    await printThermal(bill.bill_no);
    setBusy(false);
  };

  const handlePdf = async () => {
    setBusy(true);
    const res = await exportPdf(bill.bill_no);
    if (res) setPdfResult(res);
    setBusy(false);
  };

  const handleVoid = async () => {
    setBusy(true);
    await voidExistingBill(bill.bill_no);
    setBusy(false);
  };

  return (
    <SpringSheet
      open={Boolean(bill)}
      title={`Receipt ${bill.bill_no}`}
      subtitle={`${bill.client_label || "Walk-in"} · ${bill.payment_mode}`}
      onClose={() => { activeReceipt.value = null; }}
    >
      <div class="space-y-3.5 pb-4">
        {/* Thermal Receipt Simulation Paper Card */}
        <div class="rounded-[18px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] p-4 font-mono text-[12px] shadow-sm">
          {/* Header */}
          <div class="text-center border-b border-dashed border-black/20 dark:border-white/20 pb-3">
            <div class="text-[16px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {syncStatus.value?.shop_name ?? "Kura Store"}
            </div>
            {syncStatus.value?.shop_subtitle && (
              <div class="text-[11px] text-[#86868B] mt-0.5">
                {syncStatus.value.shop_subtitle}
              </div>
            )}
            {bill.voided && (
              <div class="mt-1 inline-block rounded-full bg-[#FF3B30]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#FF3B30]">
                *** VOIDED RECEIPT ***
              </div>
            )}
            <div class="mt-1 text-[11px] text-[#86868B] tabular-nums">
              {bill.hlc.slice(0, 19).replace("T", " ")} UTC
            </div>
            <div class="text-[11px] text-[#86868B] mt-0.5">
              Client: {bill.client_label || "Walk-in"} ({bill.payment_mode})
            </div>
            <div class="text-[11px] text-[#86868B]">
              Cashier: {bill.cashier_label || "Owner · K1"}
            </div>
          </div>

          {/* Line items */}
          <div class="py-3 space-y-2 border-b border-dashed border-black/20 dark:border-white/20">
            {bill.items.map((item) => (
              <div key={item.sku} class="space-y-0.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1 truncate font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {item.name}
                  </div>
                  <div class="tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {formatMoney(item.line_total_minor, sym)}
                  </div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-[#86868B]">
                  <span class="tabular-nums">{item.qty} × {formatMoney(item.unit_price_minor, sym)}</span>
                  {item.warranty_label && item.warranty_label !== "No Warranty (ওয়ারেন্টি নেই)" && (
                    <span class="text-[#34C759] italic text-[10px]">🛡 {item.warranty_label}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div class="pt-3 space-y-1.5">
            {bill.discount_minor > 0 && (
              <div class="flex justify-between text-[#86868B]">
                <span>Discount</span>
                <span class="tabular-nums">{formatMoney(-bill.discount_minor, sym)}</span>
              </div>
            )}
            <div class="flex justify-between text-[16px] font-black text-[#1D1D1F] dark:text-[#F5F5F7]">
              <span>NET TOTAL</span>
              <span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
            <div class="flex justify-between text-[11px] text-[#86868B] border-t border-black/[0.04] dark:border-white/[0.06] pt-1">
              <span>Paid ({bill.payment_mode})</span>
              <span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
            <div class="pt-2 text-center text-[10px] text-[#86868B] italic">
              * Warranty claims require this invoice &amp; intact serial tag.
            </div>
            <div class="text-center text-[11px] text-[#86868B] mt-1 font-sans">
              {syncStatus.value?.receipt_footer ?? "Thank you for shopping!"}
            </div>
          </div>
        </div>

        {/* 4-Button Action Grid */}
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handlePrint}
            class="rounded-xl bg-[#007AFF] px-3.5 py-2.5 text-[13px] font-bold text-white shadow-xs hover:brightness-105 active:scale-98 transition disabled:opacity-50"
          >
            Thermal Print ({cfg.widthMm}mm)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handlePdf}
            class="rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] px-3.5 py-2.5 text-[13px] font-bold text-[#1D1D1F] dark:text-white active:scale-98 transition disabled:opacity-50"
          >
            Save PDF
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => shareReceiptWhatsApp(bill, syncStatus.value, sym)}
            class="rounded-xl bg-[#25D366]/14 border border-[#25D366]/30 px-3.5 py-2 text-[12px] font-bold text-[#128C7E] active:scale-98 transition"
          >
            WhatsApp Share
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyReceiptText(bill, syncStatus.value, sym)}
            class="rounded-xl bg-black/[0.05] dark:bg-white/[0.08] px-3.5 py-2 text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] active:scale-98 transition"
          >
            Copy Text Bill
          </button>
        </div>

        {pdfResult && (
          <div class="rounded-xl border border-[#34C759]/25 bg-[#34C759]/10 p-3 text-[12px]">
            <div class="font-bold text-[#1E8E3E] dark:text-[#34C759]">
              Vector PDF Ready ({(pdfResult.size_bytes / 1024).toFixed(1)} KB)
            </div>
            <a
              href={pdfResult.data_url}
              download={`${bill.bill_no}.pdf`}
              class="mt-1.5 inline-block rounded-lg bg-[#34C759] px-3 py-1 text-[12px] font-bold text-white shadow-xs"
            >
              Download PDF
            </a>
          </div>
        )}

        {isOwner.value && !bill.voided && (
          <button
            type="button"
            disabled={busy}
            onClick={handleVoid}
            class="w-full rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 py-2 text-[12px] font-bold text-[#FF3B30] hover:bg-[#FF3B30]/15 active:scale-99 transition"
          >
            Void Bill &amp; Restore Stock
          </button>
        )}
      </div>
    </SpringSheet>
  );
}
