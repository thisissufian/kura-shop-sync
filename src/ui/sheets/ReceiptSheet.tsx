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
import { IconPdf, IconPrinter, IconShare } from "../primitives/KuraIcons";
import { SpringSheet } from "../primitives/SpringSheet";
import { shareReceiptWhatsApp } from "../utils/whatsappReceipt";

const BARS = [4, 2, 5, 1, 3, 2, 6, 2, 4, 1, 3, 5, 2, 3, 6, 2, 4, 1, 3, 2, 5];

export function ReceiptSheet() {
  const bill = activeReceipt.value;
  const [pdfResult, setPdfResult] = useState<PdfExportResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPdfResult(null); }, [bill?.bill_no]);
  if (!bill) return null;

  const sym = currencySymbol.value; const cfg = printerSettings.value;
  const status = syncStatus.value; const subtotal = bill.total_minor + bill.discount_minor;

  const handlePrint = async () => { setBusy(true); await printThermal(bill.bill_no); setBusy(false); };
  const handlePdf = async () => { setBusy(true); const res = await exportPdf(bill.bill_no); if (res) setPdfResult(res); setBusy(false); };
  const handleVoid = async () => { setBusy(true); await voidExistingBill(bill.bill_no); setBusy(false); };

  return (
    <SpringSheet
      open={Boolean(bill)}
      title={`Receipt ${bill.bill_no}`}
      subtitle={`${bill.client_label || "Walk-in Customer"} · ${bill.payment_mode}`}
      onClose={() => { activeReceipt.value = null; }}
    >
      <div class="space-y-3.5 pb-4">
        {/* Authentic Thermal Paper Card */}
        <div class="kura-receipt-paper p-5 font-mono text-[12px] space-y-3">
          <div class="text-center space-y-0.5">
            <div class="text-[17px] font-black tracking-tight uppercase text-[#1D1D1F] dark:text-[#F5F5F7]">
              {status?.shop_name ?? "KURA STORE"}
            </div>
            {status?.shop_subtitle && <div class="text-[11px] text-[#86868B]">{status.shop_subtitle}</div>}
            {bill.voided && (
              <div class="mt-1 inline-block rounded-full bg-[#FF3B30]/15 px-3 py-0.5 text-[11px] font-bold text-[#FF3B30]">
                *** VOIDED RECEIPT ***
              </div>
            )}
          </div>

          <div class="kura-dashed-divider" />

          {/* Meta Block */}
          <div class="space-y-1 text-[11px] text-[#86868B]">
            <div class="flex justify-between items-center tabular-nums">
              <span class="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Inv: {bill.bill_no}</span>
              <span>{bill.hlc.slice(0, 19).replace("T", " ")} UTC</span>
            </div>
            <div>Client: {bill.client_label || "Walk-in Customer"} ({bill.payment_mode})</div>
            <div>Cashier: {bill.cashier_label || "Owner · K1"}</div>
          </div>

          <div class="kura-dashed-divider" />

          {/* Line Items */}
          <div class="space-y-2.5 py-1">
            {bill.items.map((item) => (
              <div key={item.sku} class="space-y-0.5">
                <div class="flex items-start justify-between gap-2">
                  <span class="min-w-0 flex-1 truncate font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {item.name}
                  </span>
                  <span class="tabular-nums font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {formatMoney(item.line_total_minor, sym)}
                  </span>
                </div>
                <div class="text-[11px] text-[#86868B] tabular-nums">
                  {item.qty} × {formatMoney(item.unit_price_minor, sym)}
                </div>
                <div class="text-[10px] text-[#86868B] italic">
                  Warranty: {item.warranty_label || "No Warranty (ওয়ারেন্টি নেই)"}
                </div>
              </div>
            ))}
          </div>

          <div class="kura-dashed-divider" />

          {/* Summary Block */}
          <div class="space-y-1.5 text-[12px]">
            {bill.discount_minor > 0 && (
              <div class="space-y-1">
                <div class="flex justify-between text-[#86868B]"><span>Subtotal</span><span class="tabular-nums">{formatMoney(subtotal, sym)}</span></div>
                <div class="flex justify-between text-[#FF3B30] font-semibold"><span>(-) Discount</span><span class="tabular-nums">- {formatMoney(bill.discount_minor, sym)}</span></div>
              </div>
            )}
            <div class="flex justify-between text-[16px] font-black text-[#1D1D1F] dark:text-[#F5F5F7] pt-0.5">
              <span>NET TOTAL</span>
              <span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
            <div class="flex justify-between text-[12px] text-[#34C759] font-bold border-t border-black/[0.04] dark:border-white/[0.06] pt-1">
              <span>Paid ({bill.payment_mode})</span>
              <span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
          </div>

          <div class="kura-dashed-divider" />

          {/* Footer & Vector Barcode Strip */}
          <div class="text-center space-y-1.5 pt-1">
            <div class="text-[10px] text-[#86868B] italic">
              * Warranty claims require this invoice &amp; intact serial tag.
            </div>
            <div class="text-[11px] font-sans font-medium text-[#86868B]">
              {status?.receipt_footer ?? "Thank you for shopping!"}
            </div>
            <div class="flex justify-center pt-1">
              <svg width="180" height="24" viewBox="0 0 180 24" class="opacity-75 fill-current">
                {BARS.map((w, i) => (
                  <rect key={i} x={i * 8.5} y="0" width={w} height="24" />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* 2x2 Action Button Grid */}
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handlePrint}
            class="rounded-xl bg-[#007AFF] hover:bg-[#0062CC] px-3.5 py-2.5 text-[13px] font-bold text-white shadow-xs flex items-center justify-center gap-1.5 kura-btn-press disabled:opacity-50"
          >
            <IconPrinter class="w-4 h-4" />
            <span>Print ({cfg.widthMm}mm)</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handlePdf}
            class="rounded-xl kura-subtle hover:brightness-110 px-3.5 py-2.5 text-[13px] font-bold kura-text-main flex items-center justify-center gap-1.5 kura-btn-press disabled:opacity-50"
          >
            <IconPdf class="w-4 h-4" />
            <span>Save PDF</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => shareReceiptWhatsApp(bill, status, sym)}
            class="rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 px-3.5 py-2.5 text-[12px] font-bold text-[#128C7E] dark:text-[#25D366] flex items-center justify-center gap-1.5 kura-btn-press disabled:opacity-50"
          >
            <IconShare class="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => { activeReceipt.value = null; }}
            class="rounded-xl kura-subtle hover:brightness-110 px-3.5 py-2.5 text-[12px] font-bold kura-text-main flex items-center justify-center kura-btn-press"
          >
            Done
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
            class="w-full rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 py-2 text-[12px] font-bold text-[#FF3B30] hover:bg-[#FF3B30]/15 kura-btn-press disabled:opacity-50"
          >
            Void Bill &amp; Restore Stock
          </button>
        )}
      </div>
    </SpringSheet>
  );
}
