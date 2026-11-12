import { useState } from "preact/hooks";
import { saveCustomer } from "../../state/customerActions";
import { currencySymbol, customers, formatMoney, selectedCustomerId } from "../../state/kuraStore";

export function DueCustomerPicker() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const sym = currencySymbol.value;
  const custList = customers.value;

  const handleQuickAdd = async (e: Event) => {
    e.preventDefault();
    const created = await saveCustomer(name, phone);
    if (created) {
      selectedCustomerId.value = created.customer_id;
      setName("");
      setPhone("");
      setAdding(false);
    }
  };

  return (
    <div class="rounded-[11px] bg-[#FF9500]/10 border border-[#FF9500]/20 p-2 space-y-2">
      {!adding ? (
        <div class="flex gap-1.5">
          <select
            value={selectedCustomerId.value}
            onChange={(e) => {
              selectedCustomerId.value = (e.target as HTMLSelectElement).value;
            }}
            class="flex-1 rounded-[8px] border border-black/[0.08] bg-white px-2.5 py-1.5 text-[12px]"
          >
            <option value="">Select customer for due…</option>
            {custList.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.name} ({c.phone}) · Due {formatMoney(c.balance_due_minor, sym)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            class="rounded-[8px] bg-[#1D1D1F] px-2.5 py-1.5 text-[11px] font-semibold text-white"
          >
            + New
          </button>
        </div>
      ) : (
        <form onSubmit={handleQuickAdd} class="flex gap-1.5">
          <input
            required
            placeholder="Name"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-24 flex-1 rounded-[8px] border border-black/[0.08] bg-white px-2 py-1 text-[12px]"
          />
          <input
            required
            placeholder="Phone"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            class="w-24 flex-1 rounded-[8px] border border-black/[0.08] bg-white px-2 py-1 text-[12px] tabular-nums"
          />
          <button
            type="submit"
            class="rounded-[8px] bg-[#007AFF] px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            class="px-1.5 text-[11px] text-[#86868B]"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
