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
import { SearchField } from "../primitives/Controls";
import { FieldRow, Section } from "../primitives/Group";
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
      title="Customer dues"
      subtitle={`Khata · ${formatMoney(totalDueMinor.value, sym)} to collect`}
      onClose={() => {
        khataSheetOpen.value = false;
      }}
    >
      <div class="space-y-6">
        <SearchField value={query} onInput={setQuery} placeholder="Name or phone" />

        <section>
          <div class="kura-section-header">{filtered.length} {filtered.length === 1 ? "customer" : "customers"}</div>
          <div class="kura-group">
            {filtered.length === 0 && (
              <div class="kura-row justify-center py-6 text-subhead text-label-2">No matching customers.</div>
            )}
            {filtered.map((c) => {
              const owes = c.balance_due_minor > 0;
              const paying = payingId === c.customer_id;
              return (
                <div key={c.customer_id} class="kura-row !block">
                  <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="text-body text-label truncate">{c.name}</div>
                      <div class="text-footnote text-label-2 tabular-nums truncate">{c.phone}</div>
                    </div>
                    <div class="text-right">
                      <div class={`text-body font-semibold tabular-nums ${owes ? "text-warning" : "text-label-2"}`}>
                        {formatMoney(c.balance_due_minor, sym)}
                      </div>
                      <div class="text-caption text-label-2">{owes ? "owes you" : "settled"}</div>
                    </div>
                    {owes && !paying && (
                      <button type="button" class="kura-btn kura-btn-tinted kura-btn-sm"
                        onClick={() => { setPayingId(c.customer_id); setPayAmount((c.balance_due_minor / 100).toFixed(2)); }}>
                        Receive
                      </button>
                    )}
                  </div>
                  {paying && (
                    <div class="flex items-center gap-2 pt-3">
                      <input inputMode="decimal" aria-label="Amount received" value={payAmount}
                        onInput={(e) => setPayAmount((e.target as HTMLInputElement).value)}
                        class="kura-input flex-1 min-w-0 h-9 px-3 text-body tabular-nums" />
                      <button type="button" onClick={() => setPayingId(null)} class="text-subhead text-tint px-1">Cancel</button>
                      <button type="button" disabled={busy} onClick={() => void handleSettle(c.customer_id)}
                        class="kura-btn kura-btn-filled kura-btn-sm">
                        Receive
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={handleAdd}>
          <Section header="New customer">
            <FieldRow label="Name">
              <input required placeholder="Required" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} class="kura-field" />
            </FieldRow>
            <FieldRow label="Phone">
              <input required inputMode="tel" placeholder="Required" value={phone} onInput={(e) => setPhone((e.target as HTMLInputElement).value)} class="kura-field tabular-nums" />
            </FieldRow>
            <button type="submit" disabled={busy} class="kura-row text-body text-tint disabled:opacity-40">Add customer</button>
          </Section>
        </form>
      </div>
    </SpringSheet>
  );
}
