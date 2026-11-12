import { useState } from "preact/hooks";
import { saveCustomer } from "../../state/customerActions";
import {
  cartCount,
  cartLines,
  cartSubtotalMinor,
  cartTotalMinor,
  chargeAndIssueBill,
  clearCart,
  currencySymbol,
  customers,
  discountMinor,
  formatMoney,
  parseMoneyInput,
  paymentMode,
  selectedCustomerId,
  setCartQty,
} from "../../state/kuraStore";

const MODES = [
  { id: "CASH" as const, label: "Cash" },
  { id: "WALLET" as const, label: "Wallet / QR" },
  { id: "DUE" as const, label: "Customer Due" },
];

export function CheckoutPanel() {
  const [discInput, setDiscInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [addingCust, setAddingCust] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");

  const sym = currencySymbol.value;
  const lines = cartLines.value;
  const count = cartCount.value;
  const custList = customers.value;

  const handleCharge = async () => {
    setIssuing(true);
    const res = await chargeAndIssueBill();
    if (res) setDiscInput("");
    setIssuing(false);
  };

  const handleQuickAddCustomer = async (e: Event) => {
    e.preventDefault();
    const created = await saveCustomer(custName, custPhone);
    if (created) {
      selectedCustomerId.value = created.customer_id;
      setCustName("");
      setCustPhone("");
      setAddingCust(false);
    }
  };

  return (
    <div class="rounded-[18px] border border-black/[0.06] bg-white/90 backdrop-blur-xl p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] space-y-2.5">
      {lines.length > 0 && (
        <div class="hidden lg:block max-h-48 overflow-y-auto space-y-2 border-b border-black/[0.06] pb-2.5">
          {lines.map(({ product, qty, lineTotal }) => (
            <div key={product.sku} class="flex items-center justify-between gap-2 text-[13px]">
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-[#1D1D1F]">{product.name}</div>
                <div class="text-[11px] text-[#86868B] tabular-nums">
                  {qty} × {formatMoney(product.sell_price_minor, sym)}
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCartQty(product.sku, qty - 1)}
                  class="h-6 w-6 rounded-full bg-black/[0.06] text-[13px] font-semibold"
                >
                  −
                </button>
                <span class="tabular-nums font-semibold text-[#1D1D1F]">
                  {formatMoney(lineTotal, sym)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="flex items-center justify-between gap-2">
        <div class="inline-flex rounded-[10px] bg-black/[0.05] p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                paymentMode.value = m.id;
              }}
              class={`rounded-[8px] px-2 py-1 text-[11px] font-semibold transition ${
                paymentMode.value === m.id
                  ? m.id === "DUE"
                    ? "bg-[#FF9500] text-white shadow-xs"
                    : "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[11px] text-[#86868B]">Disc</span>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={discInput}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setDiscInput(v);
              discountMinor.value = parseMoneyInput(v);
            }}
            class="w-14 rounded-[8px] border border-black/[0.08] bg-[#F5F5F7] px-1.5 py-1 text-right text-[12px] tabular-nums"
          />
          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                clearCart();
                setDiscInput("");
              }}
              class="text-[11px] font-medium text-[#FF3B30] px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {paymentMode.value === "DUE" && (
        <div class="rounded-[11px] bg-[#FF9500]/10 border border-[#FF9500]/20 p-2 space-y-2">
          {!addingCust ? (
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
                onClick={() => setAddingCust(true)}
                class="rounded-[8px] bg-[#1D1D1F] px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                + New
              </button>
            </div>
          ) : (
            <form onSubmit={handleQuickAddCustomer} class="flex gap-1.5">
              <input
                required
                placeholder="Name"
                value={custName}
                onInput={(e) => setCustName((e.target as HTMLInputElement).value)}
                class="w-24 flex-1 rounded-[8px] border border-black/[0.08] bg-white px-2 py-1 text-[12px]"
              />
              <input
                required
                placeholder="Phone"
                value={custPhone}
                onInput={(e) => setCustPhone((e.target as HTMLInputElement).value)}
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
                onClick={() => setAddingCust(false)}
                class="px-1.5 text-[11px] text-[#86868B]"
              >
                ✕
              </button>
            </form>
          )}
        </div>
      )}

      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-[11px] font-medium text-[#86868B] tabular-nums">
            {count} {count === 1 ? "item" : "items"}
            {discountMinor.value > 0
              ? ` · Sub ${formatMoney(cartSubtotalMinor.value, sym)}`
              : ""}
          </div>
          <div class="text-[22px] font-bold tracking-tight text-[#1D1D1F] tabular-nums leading-tight">
            {formatMoney(cartTotalMinor.value, sym)}
          </div>
        </div>

        <button
          type="button"
          disabled={count === 0 || issuing}
          onClick={handleCharge}
          class="flex-1 max-w-[190px] rounded-[13px] bg-[#34C759] px-4 py-3 text-[15px] font-semibold text-white shadow-sm hover:brightness-105 active:scale-[0.98] disabled:opacity-40 transition"
        >
          {issuing ? "Issuing…" : "Charge & Print"}
        </button>
      </div>
    </div>
  );
}
