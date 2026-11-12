import { useState } from "preact/hooks";
import {
  exportBarcodeLabels,
  exportCatalogCsvString,
  importCatalogCsvString,
} from "../../state/catalogCsvActions";
import { isOwner, products } from "../../state/kuraStore";
import { csvSheetOpen } from "../../state/uiSignals";
import type { PdfExportResult } from "../../types/kura";
import { SpringSheet } from "../primitives/SpringSheet";

export function CsvCatalogSheet() {
  const open = csvSheetOpen.value;
  const owner = isOwner.value;
  const list = products.value;

  const [copies, setCopies] = useState("4");
  const [selectedSku, setSelectedSku] = useState("");
  const [pdfRes, setPdfRes] = useState<PdfExportResult | null>(null);
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLabels = async () => {
    setBusy(true);
    const skus = selectedSku ? [selectedSku] : [];
    const res = await exportBarcodeLabels(skus, parseInt(copies || "4", 10) || 4);
    if (res) setPdfRes(res);
    setBusy(false);
  };

  const handleExportCsv = async () => {
    setBusy(true);
    const csv = await exportCatalogCsvString();
    if (csv) {
      setCsvText(csv);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kura-catalog.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    setBusy(false);
  };

  const handleImport = async (e: Event) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBusy(true);
    await importCatalogCsvString(csvText);
    setBusy(false);
  };

  const handleFilePick = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  return (
    <SpringSheet
      open={open}
      title="Stickers PDF & CSV Catalog"
      subtitle="Pure vector Code-39 stickers & bulk inventory sync"
      onClose={() => {
        csvSheetOpen.value = false;
      }}
    >
      <div class="space-y-4">
        <div class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 space-y-3">
          <div class="text-[13px] font-semibold text-[#1D1D1F]">
            Printable Barcode Sticker Sheet PDF
          </div>
          <div class="grid grid-cols-[1fr_80px] gap-2">
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku((e.target as HTMLSelectElement).value)}
              class="rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-2 text-[12px]"
            >
              <option value="">All Products ({list.length})</option>
              {list.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={48}
              value={copies}
              onInput={(e) => setCopies((e.target as HTMLInputElement).value)}
              title="Copies per SKU"
              class="rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-2 text-center text-[12px] tabular-nums"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleLabels}
            class="w-full rounded-[11px] bg-[#007AFF] py-2.5 text-[13px] font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            Generate Barcode Stickers PDF
          </button>
          {pdfRes && (
            <div class="rounded-[10px] bg-[#34C759]/10 p-2.5 text-[11px] space-y-1">
              <div class="font-semibold text-[#1E8E3E]">
                A4 Vector PDF Ready ({(pdfRes.size_bytes / 1024).toFixed(1)} KB)
              </div>
              <div class="break-all text-[#86868B]">{pdfRes.file_path}</div>
              <a
                href={pdfRes.data_url}
                download="kura-labels.pdf"
                class="inline-block rounded-lg bg-[#34C759] px-2.5 py-1 font-semibold text-white"
              >
                Download Sticker PDF
              </a>
            </div>
          )}
        </div>

        <div class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-semibold text-[#1D1D1F]">
              1-Click CSV Catalog
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={handleExportCsv}
              class="rounded-full bg-black/[0.06] px-3 py-1 text-[11px] font-semibold text-[#1D1D1F]"
            >
              Export CSV
            </button>
          </div>

          {owner && (
            <form onSubmit={handleImport} class="space-y-2">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFilePick}
                class="block w-full text-[11px] text-[#86868B] file:mr-2 file:rounded-full file:border-0 file:bg-[#007AFF]/10 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-[#007AFF]"
              />
              <textarea
                rows={4}
                value={csvText}
                onInput={(e) => setCsvText((e.target as HTMLTextAreaElement).value)}
                placeholder="sku,name,barcode,category,sell_price,cost_price,stock_qty,low_stock_threshold"
                class="w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] p-2.5 text-[11px] font-mono"
              />
              <button
                type="submit"
                disabled={busy || !csvText.trim()}
                class="w-full rounded-[11px] bg-[#1D1D1F] py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                Import CSV into Ledger
              </button>
            </form>
          )}
        </div>
      </div>
    </SpringSheet>
  );
}
