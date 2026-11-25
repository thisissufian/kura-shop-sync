import { useEffect, useState } from "preact/hooks";
import { formatMoney, parseMoneyInput } from "../../state/ipcBridge";
import { currencySymbol, products } from "../../state/kuraStore";
import {
  recordStockPurchase,
  recordSupplierPayment,
  refreshSuppliers,
  supplierLoading,
  suppliers,
} from "../../state/supplierActions";
import { supplierSheetOpen } from "../../state/uiSignals";
import { FieldRow, Section } from "../primitives/Group";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { SpringSheet } from "../primitives/SpringSheet";

export function SupplierPayablesSheet() {
  const open = supplierSheetOpen.value;
  const sym = currencySymbol.value;
  const suppList = suppliers.value;
  const prodList = products.value;
  const loading = supplierLoading.value;

  const [tab, setTab] = useState<"LIST" | "PURCHASE">("LIST");
  const [payTargetId, setPayTargetId] = useState<string | null>(null);
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payNote, setPayNote] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [sku, setSku] = useState(prodList[0]?.sku || "");
  const [qtyStr, setQtyStr] = useState("10");
  const [costStr, setCostStr] = useState("0.00");
  const [paidStr, setPaidStr] = useState("0.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) void refreshSuppliers();
  }, [open]);

  const close = () => {
    supplierSheetOpen.value = false;
    setPayTargetId(null);
  };

  const handlePay = async (e: Event) => {
    e.preventDefault();
    if (!payTargetId) return;
    const amt = parseMoneyInput(payAmountStr);
    const ok = await recordSupplierPayment(payTargetId, amt, payNote);
    if (ok) {
      setPayTargetId(null);
      setPayAmountStr("");
      setPayNote("");
    }
  };

  const handlePurchase = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    const qty = parseInt(qtyStr, 10) || 0;
    const unitCost = parseMoneyInput(costStr);
    const paid = parseMoneyInput(paidStr);
    const ok = await recordStockPurchase({
      supplier_name: supplierName.trim(),
      supplier_phone: supplierPhone.trim(),
      sku: sku || prodList[0]?.sku || "",
      qty,
      unit_cost_minor: unitCost,
      paid_minor: paid,
    });
    setSaving(false);
    if (ok) {
      setTab("LIST");
      setSupplierName("");
      setSupplierPhone("");
      setQtyStr("10");
      setCostStr("0.00");
      setPaidStr("0.00");
    }
  };

  const v = (fn: (x: string) => void) => (e: Event) => fn((e.target as HTMLInputElement).value);
  const totalOwed = suppList.reduce((acc, x) => acc + x.payable_balance_minor, 0);

  return (
    <SpringSheet open={open} title="Suppliers" subtitle={`${formatMoney(totalOwed, sym)} owed to vendors`} onClose={close}>
      <div class="space-y-6">
        <SegmentedControl
          options={[{ id: "LIST" as const, label: "Payables", badge: suppList.length }, { id: "PURCHASE" as const, label: "Record purchase" }]}
          value={tab}
          onChange={setTab}
        />

        {tab === "LIST" ? (
          <div class="kura-group">
            {suppList.map((s) => {
              const paying = payTargetId === s.supplier_id;
              return (
                <div key={s.supplier_id} class="kura-row !block">
                  <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="text-body text-label truncate">{s.name}</div>
                      <div class="text-footnote text-label-2 tabular-nums truncate">{s.phone || "No phone"}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-body font-semibold tabular-nums text-label">{formatMoney(s.payable_balance_minor, sym)}</div>
                      <div class="text-caption text-label-2">you owe</div>
                    </div>
                    {!paying && (
                      <button type="button" class="kura-btn kura-btn-tinted kura-btn-sm"
                        onClick={() => { setPayTargetId(s.supplier_id); setPayAmountStr(""); }}>
                        Pay
                      </button>
                    )}
                  </div>
                  {paying && (
                    <form onSubmit={handlePay} class="flex flex-wrap items-center gap-2 pt-3">
                      <input required inputMode="decimal" placeholder="Amount" value={payAmountStr} onInput={v(setPayAmountStr)}
                        class="kura-input w-28 h-9 px-3 text-body tabular-nums" />
                      <input placeholder="Note" value={payNote} onInput={v(setPayNote)} class="kura-input flex-1 min-w-24 h-9 px-3 text-body" />
                      <button type="button" onClick={() => setPayTargetId(null)} class="text-subhead text-tint px-1">Cancel</button>
                      <button type="submit" class="kura-btn kura-btn-filled kura-btn-sm">Pay</button>
                    </form>
                  )}
                </div>
              );
            })}
            {suppList.length === 0 && !loading && (
              <div class="kura-row justify-center text-center py-8 text-subhead text-label-2">
                No suppliers yet. Record a purchase to add your first one.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handlePurchase} class="space-y-6">
            <Section header="Supplier">
              <FieldRow label="Name">
                <input required placeholder="Anker BD Official" value={supplierName} onInput={v(setSupplierName)} class="kura-field" />
              </FieldRow>
              <FieldRow label="Phone">
                <input inputMode="tel" placeholder="Optional" value={supplierPhone} onInput={v(setSupplierPhone)} class="kura-field tabular-nums" />
              </FieldRow>
            </Section>
            <Section header="Stock received" footer="Any amount not paid now is added to what you owe this supplier.">
              <FieldRow label="Product">
                <select value={sku} onChange={(e) => setSku((e.target as HTMLSelectElement).value)} class="kura-field">
                  {prodList.map((p) => (
                    <option key={p.sku} value={p.sku}>{p.name} · {p.stock_qty} in stock</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Quantity">
                <input required type="number" value={qtyStr} onInput={v(setQtyStr)} class="kura-field tabular-nums" />
              </FieldRow>
              <FieldRow label="Unit cost">
                <input required inputMode="decimal" value={costStr} onInput={v(setCostStr)} class="kura-field tabular-nums" />
              </FieldRow>
              <FieldRow label="Paid now">
                <input required inputMode="decimal" value={paidStr} onInput={v(setPaidStr)} class="kura-field tabular-nums" />
              </FieldRow>
            </Section>
            <button type="submit" disabled={saving} class="kura-btn kura-btn-filled kura-btn-lg w-full">
              {saving ? "Recording…" : "Record purchase"}
            </button>
          </form>
        )}
      </div>
    </SpringSheet>
  );
}
