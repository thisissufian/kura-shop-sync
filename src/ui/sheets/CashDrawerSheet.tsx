import { useEffect, useState } from "preact/hooks";
import { cashDrawerSummary, drawerLoading, logShopExpense, refreshCashDrawer } from "../../state/expenseActions";
import { currencySymbol, formatMoney, parseMoneyInput } from "../../state/kuraStore";
import { drawerSheetOpen } from "../../state/uiSignals";
import { SpringSheet } from "../primitives/SpringSheet";

const CATEGORIES = ["Supplies", "Utility / Rent", "Tea / Staff", "Transport", "Supplier Payout"];

export function CashDrawerSheet() {
  const open = drawerSheetOpen.value;
  const summary = cashDrawerSummary.value;
  const sym = currencySymbol.value;

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) void refreshCashDrawer();
  }, [open]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const minor = parseMoneyInput(amountInput);
    if (minor <= 0) return;
    setSaving(true);
    const ok = await logShopExpense(category, minor, note);
    setSaving(false);
    if (ok) {
      setAmountInput("");
      setNote("");
    }
  };

  return (
    <SpringSheet
      open={open}
      title="Cash Drawer & Petty Expenses"
      subtitle="Real-time CRDT till reconciliation"
      onClose={() => {
        drawerSheetOpen.value = false;
      }}
    >
      <div class="space-y-4">
        <div class="rounded-[16px] bg-gradient-to-br from-[#1D1D1F] to-[#2C2C2E] p-4 text-white shadow-sm">
          <div class="text-[11px] font-medium uppercase tracking-wider text-white/70">
            Expected Physical Cash in Drawer
          </div>
          <div class="mt-1 text-[28px] font-bold tracking-tight tabular-nums">
            {summary ? formatMoney(summary.expected_drawer_cash_minor, sym) : "…"}
          </div>
          {summary && (
            <div class="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5 text-[11px] tabular-nums">
              <div class="text-white/75">
                Cash Sales: <span class="font-semibold text-white">{formatMoney(summary.cash_sales_minor, sym)}</span>
              </div>
              <div class="text-white/75">
                Wallet / QR: <span class="font-semibold text-white">{formatMoney(summary.wallet_sales_minor, sym)}</span>
              </div>
              <div class="text-white/75">
                Khata In: <span class="font-semibold text-[#34C759]">{formatMoney(summary.khata_cash_collected_minor, sym)}</span>
              </div>
              <div class="text-white/75">
                Expenses Out: <span class="font-semibold text-[#FF453A]">−{formatMoney(summary.total_expenses_minor, sym)}</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          class="rounded-[14px] border border-black/[0.06] bg-[#F5F5F7] p-3 space-y-2.5"
        >
          <div class="text-[12px] font-semibold text-[#1D1D1F]">Log Petty Cash Expense</div>
          <div class="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                class={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  category === c
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white border border-black/[0.06] text-[#86868B]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div class="flex gap-2">
            <input
              required
              inputMode="decimal"
              placeholder="Amount (0.00)"
              value={amountInput}
              onInput={(e) => setAmountInput((e.target as HTMLInputElement).value)}
              class="w-28 rounded-[10px] border border-black/[0.08] bg-white px-2.5 py-2 text-[13px] tabular-nums"
            />
            <input
              placeholder="Note (e.g. Milk & cups)"
              value={note}
              onInput={(e) => setNote((e.target as HTMLInputElement).value)}
              class="flex-1 rounded-[10px] border border-black/[0.08] bg-white px-2.5 py-2 text-[13px]"
            />
            <button
              type="submit"
              disabled={saving || parseMoneyInput(amountInput) <= 0}
              class="rounded-[10px] bg-[#007AFF] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? "…" : "Log"}
            </button>
          </div>
        </form>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">
            <span>Recent Expenses</span>
            {drawerLoading.value && <span>Syncing…</span>}
          </div>
          {!summary || summary.recent_expenses.length === 0 ? (
            <div class="rounded-[12px] border border-black/[0.05] bg-white p-4 text-center text-[12px] text-[#86868B]">
              No petty expenses logged yet.
            </div>
          ) : (
            <div class="max-h-48 overflow-y-auto space-y-1.5">
              {summary.recent_expenses.map((ex) => (
                <div
                  key={ex.expense_id}
                  class="flex items-center justify-between rounded-[12px] border border-black/[0.06] bg-white px-3 py-2 text-[12px]"
                >
                  <div class="min-w-0">
                    <div class="font-semibold text-[#1D1D1F]">{ex.category}</div>
                    <div class="truncate text-[11px] text-[#86868B]">
                      {ex.note || "No note"} · {ex.node_id}
                    </div>
                  </div>
                  <div class="font-bold text-[#FF3B30] tabular-nums">
                    −{formatMoney(ex.amount_minor, sym)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SpringSheet>
  );
}
