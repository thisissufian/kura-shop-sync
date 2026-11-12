import type { PdfExportResult } from "../types/kura";
import { callBackend } from "./ipcBridge";
import { refreshBootstrap, showToast } from "./kuraStore";

export async function exportBarcodeLabels(
  skus: string[],
  copiesPerSku: number
): Promise<PdfExportResult | null> {
  try {
    const res = await callBackend<PdfExportResult>("export_barcode_labels_pdf", {
      skus,
      copiesPerSku,
    });
    showToast(`Barcode PDF ready (${(res.size_bytes / 1024).toFixed(1)} KB)`);
    return res;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function exportCatalogCsvString(): Promise<string | null> {
  try {
    const csv = await callBackend<string>("export_catalog_csv");
    showToast("Catalog CSV exported");
    return csv;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function importCatalogCsvString(csvContent: string): Promise<number> {
  try {
    const count = await callBackend<number>("import_catalog_csv", { csvContent });
    await refreshBootstrap();
    showToast(`Imported/updated ${count} product(s)`);
    return count;
  } catch (err) {
    showToast(String(err), "err");
    return 0;
  }
}
