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
const ink2 = "text-[var(--paper-ink-2)]";

export function ReceiptSheet() {
  const bill = activeReceipt.value;
  const [pdfResult, setPdfResult] = useState<PdfExportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => { setPdfResult(null); setConfirmVoid(false); }, [bill?.bill_no]);
  if (!bill) return null;

  const sym = currencySymbol.value; const cfg = printerSettings.value;
  const status = syncStatus.value; const subtotal = bill.total_minor + bill.discount_minor;

  const handlePrint = async () => { setBusy(true); await printThermal(bill.bill_no); setBusy(false); };
  const handlePdf = async () => { setBusy(true); const res = await exportPdf(bill.bill_no); if (res) setPdfResult(res); setBusy(false); };
  const handleVoid = async () => { setBusy(true); await voidExistingBill(bill.bill_no); setBusy(false); setConfirmVoid(false); };

  return (
    <SpringSheet
      open={Boolean(bill)}
      title={`Receipt ${bill.bill_no}`}
      subtitle={`${bill.client_label || "Walk-in customer"} · ${bill.payment_mode}`}
      onClose={() => { activeReceipt.value = null; }}
    >
      <div class="space-y-5">
        <div class="kura-receipt-paper mx-auto max-w-sm px-5 py-6 font-mono text-[12px] leading-[17px] space-y-3">
          <div class="text-center space-y-0.5">
            <div class="text-[16px] leading-5 font-bold uppercase">{status?.shop_name ?? "KURA STORE"}</div>
            {status?.shop_subtitle && <div class={ink2}>{status.shop_subtitle}</div>}
            {bill.voided && <div class="pt-1 font-bold text-[#D70015]">*** VOIDED ***</div>}
          </div>

          <div class="kura-dashed-divider" />
          <div class={`space-y-0.5 ${ink2}`}>
            <div class="flex justify-between gap-2 tabular-nums">
              <span class="text-[var(--paper-ink)] font-semibold">{bill.bill_no}</span>
              <span>{bill.hlc.slice(0, 16).replace("T", " ")} UTC</span>
            </div>
            <div>Customer: {bill.client_label || "Walk-in"}</div>
            <div>Cashier: {bill.cashier_label || "Owner · K1"}</div>
          </div>
          <div class="kura-dashed-divider" />

          <div class="space-y-2">
            {bill.items.map((item) => (
              <div key={item.sku}>
                <div class="flex justify-between gap-2">
                  <span class="min-w-0 truncate font-semibold">{item.name}</span>
                  <span class="tabular-nums font-semibold">{formatMoney(item.line_total_minor, sym)}</span>
                </div>
                <div class={`tabular-nums ${ink2}`}>{item.qty} × {formatMoney(item.unit_price_minor, sym)}</div>
                <div class={ink2}>Warranty: {item.warranty_label || "No Warranty (ওয়ারেন্টি নেই)"}</div>
              </div>
            ))}
          </div>

          <div class="kura-dashed-divider" />
          <div class="space-y-0.5">
            {bill.discount_minor > 0 && (
              <>
                <div class={`flex justify-between ${ink2}`}><span>Subtotal</span><span class="tabular-nums">{formatMoney(subtotal, sym)}</span></div>
                <div class={`flex justify-between ${ink2}`}><span>Discount</span><span class="tabular-nums">−{formatMoney(bill.discount_minor, sym)}</span></div>
              </>
            )}
            <div class="flex justify-between text-[15px] leading-6 font-bold">
              <span>TOTAL</span><span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
            <div class={`flex justify-between ${ink2}`}>
              <span>Paid · {bill.payment_mode}</span><span class="tabular-nums">{formatMoney(bill.total_minor, sym)}</span>
            </div>
          </div>
          <div class="kura-dashed-divider" />

          <div class={`text-center space-y-1.5 ${ink2}`}>
            <div>Warranty claims need this invoice and an intact serial tag.</div>
            <div class="text-[var(--paper-ink)]">{status?.receipt_footer ?? "Thank you for shopping!"}</div>
            <svg width="180" height="24" viewBox="0 0 180 24" class="mx-auto fill-[var(--paper-ink)]" aria-hidden="true">
              {BARS.map((w, i) => <rect key={i} x={i * 8.5} y="0" width={w} height="24" />)}
            </svg>
          </div>
        </div>

        <div class="space-y-2.5">
          <button type="button" disabled={busy} onClick={handlePrint} class="kura-btn kura-btn-filled kura-btn-lg w-full">
            <IconPrinter class="w-5 h-5" />
            Print receipt · {cfg.widthMm} mm
          </button>
          <div class="grid grid-cols-2 gap-2.5">
            <button type="button" disabled={busy} onClick={handlePdf} class="kura-btn kura-btn-gray">
              <IconPdf class="w-5 h-5" /> Save PDF
            </button>
            <button type="button" disabled={busy} onClick={() => shareReceiptWhatsApp(bill, status, sym)} class="kura-btn kura-btn-gray">
              <IconShare class="w-5 h-5" /> WhatsApp
            </button>
          </div>
        </div>

        {pdfResult && (
          <div class="kura-group kura-row">
            <div class="min-w-0 flex-1">
              <div class="text-body text-label">PDF ready</div>
              <div class="text-footnote text-label-2 tabular-nums">{(pdfResult.size_bytes / 1024).toFixed(1)} KB vector PDF</div>
            </div>
            <a href={pdfResult.data_url} download={`${bill.bill_no}.pdf`} class="kura-btn kura-btn-tinted kura-btn-sm">Download</a>
          </div>
        )}

        {isOwner.value && !bill.voided && (
          confirmVoid ? (
            <div class="kura-group p-4 space-y-3">
              <p class="text-subhead text-label">
                Void {bill.bill_no}? Its items go back into stock. This can't be undone.
              </p>
              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setConfirmVoid(false)} class="kura-btn kura-btn-gray">Cancel</button>
                <button type="button" disabled={busy} onClick={handleVoid} class="kura-btn kura-btn-danger-filled">Void bill</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmVoid(true)} class="kura-btn kura-btn-destructive w-full">
              Void bill and restore stock
            </button>
          )
        )}
      </div>
    </SpringSheet>
  );
}
