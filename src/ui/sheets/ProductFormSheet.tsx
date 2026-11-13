import { useEffect, useState } from "preact/hooks";
import {
  editingProduct,
  parseMoneyInput,
  productSheetOpen,
  saveProduct,
} from "../../state/kuraStore";
import { scannedBarcodePrefill, scannerMode } from "../../state/uiSignals";
import { SpringSheet } from "../primitives/SpringSheet";

const minorToInput = (m: number) => (m / 100).toFixed(2);

export const WARRANTY_PRESETS = [
  "No Warranty (ওয়ারেন্টি নেই)",
  "7 Days Replacement",
  "6 Months Warranty",
  "1 Year Official Warranty",
];

export function ProductFormSheet() {
  const open = productSheetOpen.value;
  const existing = editingProduct.value;

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("General");
  const [brand, setBrand] = useState("");
  const [variant, setVariant] = useState("");
  const [warranty, setWarranty] = useState(WARRANTY_PRESETS[0]);
  const [sellStr, setSellStr] = useState("0.00");
  const [costStr, setCostStr] = useState("0.00");
  const [stockStr, setStockStr] = useState("0");
  const [threshStr, setThreshStr] = useState("5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setSku(existing.sku);
      setName(existing.name);
      setBarcode(existing.barcode ?? "");
      setCategory(existing.category);
      setBrand(existing.brand || "");
      setVariant(existing.variant || "");
      setWarranty(existing.warranty_label || WARRANTY_PRESETS[0]);
      setSellStr(minorToInput(existing.sell_price_minor));
      setCostStr(minorToInput(existing.cost_price_minor));
      setStockStr(String(existing.stock_qty));
      setThreshStr(String(existing.low_stock_threshold));
    } else {
      setSku(`SKU-${Math.floor(100 + Math.random() * 899)}`);
      setName("");
      setBarcode(scannedBarcodePrefill.value ?? "");
      scannedBarcodePrefill.value = null;
      setCategory("General");
      setBrand("");
      setVariant("");
      setWarranty(WARRANTY_PRESETS[0]);
      setSellStr("");
      setCostStr("");
      setStockStr("10");
      setThreshStr("5");
    }
  }, [open, existing]);

  const close = () => {
    productSheetOpen.value = false;
    editingProduct.value = null;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    const ok = await saveProduct({
      sku: sku.trim(),
      name: name.trim(),
      barcode: barcode.trim() ? barcode.trim() : null,
      category: category.trim() || "General",
      brand: brand.trim(),
      variant: variant.trim(),
      warranty_label: warranty.trim(),
      sell_price_minor: parseMoneyInput(sellStr),
      cost_price_minor: parseMoneyInput(costStr),
      stock_qty: parseInt(stockStr || "0", 10) || 0,
      low_stock_threshold: parseInt(threshStr || "5", 10) || 5,
    });
    setSaving(false);
    if (ok) close();
  };

  const inputCls = "mt-1 w-full rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] bg-[#F5F5F7] dark:bg-white/[0.05] px-3 py-1.5 text-[13px]";

  return (
    <SpringSheet
      open={open}
      title={existing ? `Edit ${existing.sku}` : "New Product"}
      subtitle="Stored as integer minor units in CRDT ledger"
      onClose={close}
    >
      <form onSubmit={handleSubmit} class="space-y-3 pb-4">
        <div class="rounded-[16px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-3.5 space-y-2.5">
          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">SKU</span>
              <input required disabled={Boolean(existing)} value={sku} onInput={(e) => setSku((e.target as HTMLInputElement).value)} class={`${inputCls} disabled:opacity-60`} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Category</span>
              <input value={category} onInput={(e) => setCategory((e.target as HTMLInputElement).value)} class={inputCls} />
            </label>
          </div>

          <label class="block">
            <span class="text-[11px] font-medium text-[#86868B]">Product Name</span>
            <input required placeholder="e.g. Rapid Charger 65W GaN" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} class={`${inputCls} py-2 text-[14px]`} />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Brand</span>
              <input placeholder="e.g. HOCO / Anker" value={brand} onInput={(e) => setBrand((e.target as HTMLInputElement).value)} class={inputCls} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Variant / Color</span>
              <input placeholder="e.g. White · 128GB" value={variant} onInput={(e) => setVariant((e.target as HTMLInputElement).value)} class={inputCls} />
            </label>
          </div>

          <label class="block">
            <span class="text-[11px] font-medium text-[#86868B]">Warranty Policy</span>
            <select value={warranty} onChange={(e) => setWarranty((e.target as HTMLSelectElement).value)} class={`${inputCls} py-2`}>
              {WARRANTY_PRESETS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </label>

          <div class="block">
            <span class="text-[11px] font-medium text-[#86868B]">Barcode (Optional)</span>
            <div class="mt-1 flex gap-2">
              <input placeholder="Scan or type EAN / UPC" value={barcode} onInput={(e) => setBarcode((e.target as HTMLInputElement).value)} class={`flex-1 ${inputCls} mt-0 tabular-nums`} />
              {!existing && (
                <button
                  type="button"
                  onClick={() => { productSheetOpen.value = false; scannerMode.value = "BARCODE_PREFILL"; }}
                  class="rounded-[10px] bg-[#007AFF]/10 text-[#007AFF] px-3 py-1.5 text-[12px] font-semibold active:scale-95"
                >
                  Cam
                </button>
              )}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Sell Price</span>
              <input required inputMode="decimal" value={sellStr} onInput={(e) => setSellStr((e.target as HTMLInputElement).value)} class={`${inputCls} tabular-nums`} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Cost Price</span>
              <input required inputMode="decimal" value={costStr} onInput={(e) => setCostStr((e.target as HTMLInputElement).value)} class={`${inputCls} tabular-nums`} />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Stock Qty</span>
              <input type="number" value={stockStr} onInput={(e) => setStockStr((e.target as HTMLInputElement).value)} class={`${inputCls} tabular-nums`} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Low Alert</span>
              <input type="number" value={threshStr} onInput={(e) => setThreshStr((e.target as HTMLInputElement).value)} class={`${inputCls} tabular-nums`} />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          class="w-full rounded-[14px] bg-[#007AFF] py-3 text-[14px] font-bold text-white shadow-sm hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : existing ? "Update Product" : "Add to Kura Vault"}
        </button>
      </form>
    </SpringSheet>
  );
}
