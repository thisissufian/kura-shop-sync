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

  const inp = "mt-1 w-full rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] bg-[#F5F5F7] dark:bg-white/[0.05] px-3 py-1.5 text-[13px]";

  return (
    <SpringSheet open={open} title="Supplier Payables & Purchase" subtitle="Vendor Dues & Inventory Restock Ledger" onClose={close}>
      <div class="space-y-3 pb-6">
        <div class="flex rounded-xl bg-black/[0.05] dark:bg-white/[0.08] p-1">
          <button type="button" onClick={() => setTab("LIST")} class={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${tab === "LIST" ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs" : "text-[#86868B]"}`}>
            Vendors & Dues ({suppList.length})
          </button>
          <button type="button" onClick={() => setTab("PURCHASE")} class={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition ${tab === "PURCHASE" ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white shadow-xs" : "text-[#86868B]"}`}>
            + Stock Purchase
          </button>
        </div>

        {tab === "LIST" ? (
          <div class="space-y-2.5">
            {suppList.map((s) => (
              <div key={s.supplier_id} class="rounded-[16px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-3.5 space-y-2 shadow-xs">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-bold text-[14px] text-[#1D1D1F] dark:text-white">{s.name}</h4>
                    <p class="text-[11px] text-[#86868B]">{s.phone || "No phone"} · {s.supplier_id}</p>
                  </div>
                  <div class="text-right">
                    <span class="text-[10px] text-[#86868B] uppercase font-semibold">Payable Due</span>
                    <div class="text-[16px] font-bold text-[#FF3B30] tabular-nums">{formatMoney(s.payable_balance_minor, sym)}</div>
                  </div>
                </div>
                {payTargetId === s.supplier_id ? (
                  <form onSubmit={handlePay} class="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                    <div class="flex gap-2">
                      <input required inputMode="decimal" placeholder="Amount" value={payAmountStr} onInput={(e) => setPayAmountStr((e.target as HTMLInputElement).value)} class={`flex-1 ${inp} mt-0 tabular-nums`} />
                      <input placeholder="Note / Ref" value={payNote} onInput={(e) => setPayNote((e.target as HTMLInputElement).value)} class={`flex-1 ${inp} mt-0`} />
                    </div>
                    <div class="flex gap-2">
                      <button type="button" onClick={() => setPayTargetId(null)} class="flex-1 py-1.5 rounded-lg border border-black/[0.08] text-[12px] font-medium">Cancel</button>
                      <button type="submit" class="flex-1 py-1.5 rounded-lg bg-[#34C759] text-white text-[12px] font-bold">Confirm Payment</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => { setPayTargetId(s.supplier_id); setPayAmountStr(""); }} class="w-full py-1.5 rounded-lg bg-[#007AFF]/10 text-[#007AFF] text-[12px] font-semibold active:scale-98 transition">
                    Pay Supplier
                  </button>
                )}
              </div>
            ))}
            {suppList.length === 0 && !loading && (
              <div class="text-center py-8 text-[#86868B] text-[13px]">
                No supplier records yet. Switch to "+ Stock Purchase" to record your first vendor purchase.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handlePurchase} class="rounded-[16px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-3.5 space-y-2.5 shadow-xs">
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Supplier Name</span>
              <input required placeholder="e.g. Anker BD Official" value={supplierName} onInput={(e) => setSupplierName((e.target as HTMLInputElement).value)} class={inp} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Phone</span>
              <input placeholder="e.g. 01700-112233" value={supplierPhone} onInput={(e) => setSupplierPhone((e.target as HTMLInputElement).value)} class={inp} />
            </label>
            <label class="block">
              <span class="text-[11px] font-medium text-[#86868B]">Product SKU</span>
              <select value={sku} onChange={(e) => setSku((e.target as HTMLSelectElement).value)} class={`${inp} py-2`}>
                {prodList.map((p) => (
                  <option key={p.sku} value={p.sku}>{p.name} ({p.sku}) · Stock: {p.stock_qty}</option>
                ))}
              </select>
            </label>
            <div class="grid grid-cols-3 gap-2">
              <label class="block">
                <span class="text-[11px] font-medium text-[#86868B]">Qty</span>
                <input required type="number" value={qtyStr} onInput={(e) => setQtyStr((e.target as HTMLInputElement).value)} class={`${inp} px-2 tabular-nums`} />
              </label>
              <label class="block">
                <span class="text-[11px] font-medium text-[#86868B]">Unit Cost</span>
                <input required inputMode="decimal" value={costStr} onInput={(e) => setCostStr((e.target as HTMLInputElement).value)} class={`${inp} px-2 tabular-nums`} />
              </label>
              <label class="block">
                <span class="text-[11px] font-medium text-[#86868B]">Amount Paid</span>
                <input required inputMode="decimal" value={paidStr} onInput={(e) => setPaidStr((e.target as HTMLInputElement).value)} class={`${inp} px-2 tabular-nums`} />
              </label>
            </div>
            <button type="submit" disabled={saving} class="w-full mt-2 py-2.5 rounded-xl bg-[#007AFF] text-white font-bold text-[13px] shadow-sm active:scale-98 transition disabled:opacity-50">
              {saving ? "Recording Purchase…" : "Record Purchase & Restock"}
            </button>
          </form>
        )}
      </div>
    </SpringSheet>
  );
}
