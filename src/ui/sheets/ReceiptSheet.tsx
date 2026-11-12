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
      subtitle={`Node ${bill.node_id} · ${bill.payment_mode}`}
      onClose={() => {
        activeReceipt.value = null;
      }}
    >
      <div class="space-y-4">
        <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 font-mono text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div class="text-center border-b border-dashed border-black/15 pb-3">
            <div class="text-[15px] font-bold tracking-tight text-[#1D1D1F]">
              {syncStatus.value?.shop_name ?? "Kura Store"}
            </div>
            {syncStatus.value?.shop_subtitle && (
              <div class="mt-0.5 text-[11px] text-[#86868B]">
                {syncStatus.value.shop_subtitle}
              </div>
            )}
            {bill.voided && (
              <div class="mt-1 inline-block rounded-full bg-[#FF3B30]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#FF3B30]">
                VOIDED RECEIPT
              </div>
            )}
            <div class="mt-1 text-[11px] text-[#86868B] tabular-nums">
              {bill.hlc.slice(0, 19).replace("T", " ")} UTC
            </div>
          </div>

          <div class="py-3 space-y-2 border-b border-dashed border-black/15">
            {bill.items.map((item) => (
              <div key={item.sku} class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[#1D1D1F] font-medium">{item.name}</div>
                  <div class="text-[11px] text-[#86868B] tabular-nums">
                    {item.qty} × {formatMoney(item.unit_price_minor, sym)}
                  </div>
                </div>
                <div class="tabular-nums font-semibold text-[#1D1D1F]">
                  {formatMoney(item.line_total_minor, sym)}
                </div>
              </div>
            ))}
          </div>

          <div class="pt-3 space-y-1">
            {bill.discount_minor > 0 && (
              <div class="flex justify-between text-[#86868B]">
                <span>Discount</span>
                <span class="tabular-nums">
                  {formatMoney(-bill.discount_minor, sym)}
                </span>
              </div>
            )}
            <div class="flex justify-between text-[15px] font-bold text-[#1D1D1F]">
              <span>TOTAL</span>
              <span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
            <div class="pt-2 text-center text-[11px] text-[#86868B]">
              {syncStatus.value?.receipt_footer ?? "Thank you for shopping!"}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={handlePrint}
            class="rounded-[12px] bg-[#007AFF] px-3.5 py-3 text-[14px] font-semibold text-white shadow-sm hover:brightness-105 active:scale-[0.98] disabled:opacity-50 transition"
          >
            Print {cfg.widthMm}mm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handlePdf}
            class="rounded-[12px] bg-white border border-black/[0.08] px-3.5 py-3 text-[14px] font-semibold text-[#1D1D1F] hover:bg-black/[0.02] active:scale-[0.98] disabled:opacity-50 transition"
          >
            Export PDF
          </button>
        </div>

        {pdfResult && (
          <div class="rounded-[14px] border border-[#34C759]/25 bg-[#34C759]/10 p-3 text-[12px] text-[#1D1D1F]">
            <div class="font-semibold">
              Vector PDF Ready ({(pdfResult.size_bytes / 1024).toFixed(1)} KB)
            </div>
            <div class="mt-0.5 break-all text-[#86868B]">{pdfResult.file_path}</div>
            <a
              href={pdfResult.data_url}
              download={`${bill.bill_no}.pdf`}
              class="mt-2 inline-block rounded-lg bg-[#34C759] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Download / Share PDF
            </a>
          </div>
        )}

        {isOwner.value && !bill.voided && (
          <button
            type="button"
            disabled={busy}
            onClick={handleVoid}
            class="w-full rounded-[12px] border border-[#FF3B30]/25 bg-[#FF3B30]/10 py-2.5 text-[13px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/15 active:scale-[0.99] transition"
          >
            Void Bill &amp; Restore Stock
          </button>
        )}
      </div>
    </SpringSheet>
  );
}
