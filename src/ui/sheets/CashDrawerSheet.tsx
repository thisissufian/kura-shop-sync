import { useEffect, useState } from "preact/hooks";
import { cashDrawerSummary, drawerLoading, logShopExpense, refreshCashDrawer } from "../../state/expenseActions";
import { currencySymbol, formatMoney, parseMoneyInput } from "../../state/kuraStore";
import { drawerSheetOpen } from "../../state/uiSignals";
import { FieldRow, Row, Section } from "../primitives/Group";
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

  const m = (minor: number) => formatMoney(minor, sym);

  return (
    <SpringSheet
      open={open}
      title="Cash drawer"
      subtitle="Today's till and petty expenses"
      onClose={() => {
        drawerSheetOpen.value = false;
      }}
    >
      <div class="space-y-6">
        <section>
          <div class="kura-group">
            <div class="px-4 pt-4 pb-3">
              <div class="text-subhead text-label-2">Expected cash in drawer</div>
              <div class="text-[40px] leading-[48px] font-bold tracking-tight tabular-nums text-label">
                {summary ? m(summary.expected_drawer_cash_minor) : "…"}
              </div>
            </div>
            {summary && (
              <>
                <Row label="Cash sales" value={m(summary.cash_sales_minor)} />
                <Row label="Wallet / QR sales" detail="Not in the drawer" value={m(summary.wallet_sales_minor)} />
                <Row label="Dues collected" value={`+${m(summary.khata_cash_collected_minor)}`} valueClass="text-positive" />
                <Row label="Expenses paid out" value={`−${m(summary.total_expenses_minor)}`} valueClass="text-danger" />
              </>
            )}
          </div>
        </section>

        <form onSubmit={handleSubmit}>
          <Section header="Log an expense">
            <div class="kura-row flex-wrap !gap-2 !py-3">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} class="kura-chip">
                  {c}
                </button>
              ))}
            </div>
            <FieldRow label="Amount">
              <input required inputMode="decimal" placeholder="0.00" value={amountInput}
                onInput={(e) => setAmountInput((e.target as HTMLInputElement).value)} class="kura-field tabular-nums" />
            </FieldRow>
            <FieldRow label="Note">
              <input placeholder="Milk and cups" value={note}
                onInput={(e) => setNote((e.target as HTMLInputElement).value)} class="kura-field" />
            </FieldRow>
            <button type="submit" disabled={saving || parseMoneyInput(amountInput) <= 0}
              class="kura-row text-body text-tint disabled:opacity-40">
              {saving ? "Logging…" : `Log ${category} expense`}
            </button>
          </Section>
        </form>

        <Section header="Recent expenses" trailing={drawerLoading.value ? <span>Updating…</span> : undefined}>
          {!summary || summary.recent_expenses.length === 0 ? (
            <div class="kura-row justify-center py-6 text-subhead text-label-2">No expenses logged yet.</div>
          ) : (
            summary.recent_expenses.map((ex) => (
              <Row key={ex.expense_id} label={ex.category} detail={`${ex.note || "No note"} · ${ex.node_id}`}
                value={`−${m(ex.amount_minor)}`} valueClass="text-label" />
            ))
          )}
        </Section>
      </div>
    </SpringSheet>
  );
}
