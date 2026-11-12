import { useMemo, useState } from "preact/hooks";
import {
  saveCustomer,
  settleCustomerDue,
  totalDueMinor,
} from "../../state/customerActions";
import {
  currencySymbol,
  customers,
  formatMoney,
  parseMoneyInput,
} from "../../state/kuraStore";
import { khataSheetOpen } from "../../state/uiSignals";
import { SpringSheet } from "../primitives/SpringSheet";

export function CustomerKhataSheet() {
  const open = khataSheetOpen.value;
  const list = customers.value;
  const sym = currencySymbol.value;

  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [list, query]);

  const handleAdd = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const ok = await saveCustomer(name, phone);
    if (ok) {
      setName("");
      setPhone("");
    }
    setBusy(false);
  };

  const handleSettle = async (customerId: string) => {
    const minor = parseMoneyInput(payAmount);
    if (minor <= 0) return;
    setBusy(true);
    const ok = await settleCustomerDue(customerId, minor, "Khata Settlement");
    if (ok) {
      setPayingId(null);
      setPayAmount("");
    }
    setBusy(false);
  };

  return (
    <SpringSheet
      open={open}
      title="Customer Due (Khata)"
      subtitle={`Total Receivables: ${formatMoney(totalDueMinor.value, sym)}`}
      onClose={() => {
        khataSheetOpen.value = false;
      }}
    >
      <div class="space-y-3.5">
        <input
          type="search"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search customer by name or phone…"
          class="w-full rounded-[12px] border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px]"
        />

        <form
          onSubmit={handleAdd}
          class="rounded-[14px] border border-black/[0.06] bg-white p-3 flex gap-2"
        >
          <input
            required
            placeholder="Customer Name"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="flex-1 min-w-0 rounded-[9px] border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1.5 text-[12px]"
          />
          <input
            required
            placeholder="Phone"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            class="w-28 rounded-[9px] border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1.5 text-[12px] tabular-nums"
          />
          <button
            type="submit"
            disabled={busy}
            class="rounded-[9px] bg-[#007AFF] px-3 py-1.5 text-[12px] font-semibold text-white active:scale-95"
          >
            Add
          </button>
        </form>

        <div class="space-y-2">
          {filtered.length === 0 ? (
            <div class="rounded-[14px] bg-white p-6 text-center text-[13px] text-[#86868B]">
              No matching customer accounts.
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.customer_id}
                class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 space-y-2.5"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-[14px] font-semibold text-[#1D1D1F]">
                      {c.name}
                    </div>
                    <div class="text-[11px] text-[#86868B] tabular-nums">
                      {c.phone} · {c.customer_id}
                    </div>
                  </div>
                  <div class="text-right">
                    <div
                      class={`text-[15px] font-bold tabular-nums ${
                        c.balance_due_minor > 0 ? "text-[#FF3B30]" : "text-[#34C759]"
                      }`}
                    >
                      {formatMoney(c.balance_due_minor, sym)}
                    </div>
                    {c.balance_due_minor > 0 && payingId !== c.customer_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingId(c.customer_id);
                          setPayAmount((c.balance_due_minor / 100).toFixed(2));
                        }}
                        class="mt-1 rounded-full bg-[#34C759]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#1E8E3E]"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                </div>

                {payingId === c.customer_id && (
                  <div class="flex gap-2 pt-1 border-t border-black/[0.06]">
                    <input
                      inputMode="decimal"
                      value={payAmount}
                      onInput={(e) => setPayAmount((e.target as HTMLInputElement).value)}
                      class="flex-1 rounded-[9px] border border-black/[0.08] bg-[#F5F5F7] px-2.5 py-1.5 text-[13px] tabular-nums"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSettle(c.customer_id)}
                      class="rounded-[9px] bg-[#34C759] px-3 py-1.5 text-[12px] font-semibold text-white"
                    >
                      Receive
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayingId(null)}
                      class="px-2 text-[12px] text-[#86868B]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </SpringSheet>
  );
}
