import { useEffect, useState } from "preact/hooks";
import {
  editingProduct,
  parseMoneyInput,
  productSheetOpen,
  saveProduct,
} from "../../state/kuraStore";
import { scannedBarcodePrefill, scannerMode } from "../../state/uiSignals";
import { FieldRow, Section } from "../primitives/Group";
import { IconBarcodeScan } from "../primitives/KuraIcons";
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

  const set = (fn: (v: string) => void) => (e: Event) => fn((e.target as HTMLInputElement).value);

  return (
    <SpringSheet
      open={open}
      title={existing ? "Edit product" : "New product"}
      subtitle={existing ? existing.name : undefined}
      onClose={close}
    >
      <form onSubmit={handleSubmit} class="space-y-6">
        <Section header="Product">
          <FieldRow label="Name">
            <input required placeholder="Rapid Charger 65W" value={name} onInput={set(setName)} class="kura-field" />
          </FieldRow>
          <FieldRow label="Brand">
            <input placeholder="Optional" value={brand} onInput={set(setBrand)} class="kura-field" />
          </FieldRow>
          <FieldRow label="Variant">
            <input placeholder="White · 128 GB" value={variant} onInput={set(setVariant)} class="kura-field" />
          </FieldRow>
          <FieldRow label="Category">
            <input value={category} onInput={set(setCategory)} class="kura-field" />
          </FieldRow>
        </Section>

        <Section header="Price" footer="Stored as whole paisa, so totals never drift.">
          <FieldRow label="Selling price">
            <input required inputMode="decimal" placeholder="0.00" value={sellStr} onInput={set(setSellStr)} class="kura-field tabular-nums" />
          </FieldRow>
          <FieldRow label="Cost price">
            <input required inputMode="decimal" placeholder="0.00" value={costStr} onInput={set(setCostStr)} class="kura-field tabular-nums" />
          </FieldRow>
        </Section>

        <Section header="Stock">
          <FieldRow label="In stock">
            <input type="number" value={stockStr} onInput={set(setStockStr)} class="kura-field tabular-nums" />
          </FieldRow>
          <FieldRow label="Low-stock alert at">
            <input type="number" value={threshStr} onInput={set(setThreshStr)} class="kura-field tabular-nums" />
          </FieldRow>
          <FieldRow label="Warranty">
            <select value={warranty} onChange={(e) => setWarranty((e.target as HTMLSelectElement).value)} class="kura-field">
              {WARRANTY_PRESETS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </FieldRow>
        </Section>

        <Section header="Identification">
          <FieldRow label="SKU">
            <input required disabled={Boolean(existing)} value={sku} onInput={set(setSku)} class="kura-field tabular-nums disabled:text-label-2" />
          </FieldRow>
          <FieldRow label="Barcode">
            <input placeholder="EAN / UPC" value={barcode} onInput={set(setBarcode)} class="kura-field tabular-nums" />
            {!existing && (
              <button type="button" title="Scan barcode" aria-label="Scan barcode"
                onClick={() => { productSheetOpen.value = false; scannerMode.value = "BARCODE_PREFILL"; }}
                class="kura-icon-btn !w-8 !h-8">
                <IconBarcodeScan class="w-[18px] h-[18px]" />
              </button>
            )}
          </FieldRow>
        </Section>

        <button type="submit" disabled={saving} class="kura-btn kura-btn-filled kura-btn-lg w-full">
          {saving ? "Saving…" : existing ? "Save changes" : "Add product"}
        </button>
      </form>
    </SpringSheet>
  );
}
