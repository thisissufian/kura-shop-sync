import { useState } from "preact/hooks";
import { saveCustomer } from "../../state/customerActions";
import { currencySymbol, customers, formatMoney, selectedCustomerId } from "../../state/kuraStore";

/** Who owes this sale. A customer select, or an inline new-customer form. */
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

  const fieldCls = "kura-input h-9 px-3 text-subhead min-w-0";

  return !adding ? (
    <div class="flex gap-2">
      <select
        value={selectedCustomerId.value}
        onChange={(e) => { selectedCustomerId.value = (e.target as HTMLSelectElement).value; }}
        class={`${fieldCls} flex-1`}
        aria-label="Customer who owes this sale"
      >
        <option value="">Choose a customer…</option>
        {custList.map((c) => (
          <option key={c.customer_id} value={c.customer_id}>
            {c.name} · owes {formatMoney(c.balance_due_minor, sym)}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setAdding(true)} class="kura-btn kura-btn-gray kura-btn-sm !rounded-[10px] h-9">
        New
      </button>
    </div>
  ) : (
    <form onSubmit={handleQuickAdd} class="flex gap-2">
      <input required placeholder="Name" value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)} class={`${fieldCls} flex-1`} />
      <input required placeholder="Phone" inputMode="tel" value={phone}
        onInput={(e) => setPhone((e.target as HTMLInputElement).value)} class={`${fieldCls} w-28 tabular-nums`} />
      <button type="submit" class="kura-btn kura-btn-filled kura-btn-sm !rounded-[10px] h-9">Save</button>
      <button type="button" onClick={() => setAdding(false)} class="text-subhead text-tint px-1">Cancel</button>
    </form>
  );
}
