import { useState } from "preact/hooks";
import {
  exportBarcodeLabels,
  exportCatalogCsvString,
  importCatalogCsvString,
} from "../../state/catalogCsvActions";
import { isOwner, products } from "../../state/kuraStore";
import { csvSheetOpen } from "../../state/uiSignals";
import type { PdfExportResult } from "../../types/kura";
import { FieldRow, Section } from "../primitives/Group";
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
      title="Labels & CSV"
      subtitle="Barcode stickers and bulk catalog"
      onClose={() => {
        csvSheetOpen.value = false;
      }}
    >
      <div class="space-y-6">
        <Section header="Barcode labels" footer="A4 sheet of vector Code-39 stickers.">
          <FieldRow label="Products">
            <select value={selectedSku} onChange={(e) => setSelectedSku((e.target as HTMLSelectElement).value)} class="kura-field">
              <option value="">All ({list.length})</option>
              {list.map((p) => (
                <option key={p.sku} value={p.sku}>{p.name}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Copies of each">
            <input type="number" min={1} max={48} value={copies}
              onInput={(e) => setCopies((e.target as HTMLInputElement).value)} class="kura-field tabular-nums" />
          </FieldRow>
          <button type="button" disabled={busy} onClick={handleLabels} class="kura-row text-body text-tint disabled:opacity-40">
            Make label sheet
          </button>
          {pdfRes && (
            <div class="kura-row">
              <div class="min-w-0 flex-1">
                <div class="text-body text-label">PDF ready</div>
                <div class="text-footnote text-label-2 tabular-nums">{(pdfRes.size_bytes / 1024).toFixed(1)} KB</div>
              </div>
              <a href={pdfRes.data_url} download="kura-labels.pdf" class="kura-btn kura-btn-tinted kura-btn-sm">Download</a>
            </div>
          )}
        </Section>

        <Section header="Catalog" footer={owner ? "Columns: sku, name, barcode, category, sell_price, cost_price, stock_qty, low_stock_threshold." : undefined}>
          <button type="button" disabled={busy} onClick={handleExportCsv} class="kura-row text-body text-tint disabled:opacity-40">
            Export catalog as CSV
          </button>
          {owner && (
            <form onSubmit={handleImport} class="kura-row !block space-y-3 !py-3">
              <input type="file" accept=".csv,text/csv" onChange={handleFilePick}
                class="block w-full text-footnote text-label-2 file:mr-3 file:rounded-full file:border-0 file:bg-fill file:px-3.5 file:py-1.5 file:text-subhead file:font-medium file:text-tint" />
              <textarea rows={4} value={csvText} onInput={(e) => setCsvText((e.target as HTMLTextAreaElement).value)}
                placeholder="…or paste CSV rows here" class="kura-input w-full p-3 text-footnote font-mono" />
              <button type="submit" disabled={busy || !csvText.trim()} class="kura-btn kura-btn-filled w-full">
                Import into catalog
              </button>
            </form>
          )}
        </Section>
      </div>
    </SpringSheet>
  );
}
