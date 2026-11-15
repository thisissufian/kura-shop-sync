import { useState } from "preact/hooks";
import {
  cartCount,
  cartLines,
  cartSubtotalMinor,
  cartTotalMinor,
  chargeAndIssueBill,
  clearCart,
  currencySymbol,
  discountMinor,
  formatMoney,
  parseMoneyInput,
  paymentMode,
  setCartQty,
} from "../../state/kuraStore";
import { holdCurrentCart } from "../../state/parkedCarts";
import { DueCustomerPicker } from "./DueCustomerPicker";

const MODES = [
  { id: "CASH" as const, label: "Cash" },
  { id: "WALLET" as const, label: "Wallet / QR" },
  { id: "DUE" as const, label: "Customer Due" },
];

export function CheckoutPanel() {
  const [discInput, setDiscInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const sym = currencySymbol.value;
  const lines = cartLines.value;
  const count = cartCount.value;

  const handleCharge = async () => {
    setIssuing(true);
    const res = await chargeAndIssueBill();
    if (res) setDiscInput("");
    setIssuing(false);
  };

  const handleHold = () => {
    if (holdCurrentCart()) setDiscInput("");
  };

  return (
    <div class="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] kura-glass-bar p-3.5 shadow-xl space-y-2.5">
      {/* Collapsible Item Drawer */}
      {lines.length > 0 && (
        <div class={`${expanded ? "block" : "hidden lg:block"} max-h-48 overflow-y-auto space-y-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-2.5`}>
          {lines.map(({ product, qty, lineTotal }) => (
            <div key={product.sku} class="flex items-center justify-between gap-2 text-[13px]">
              <div class="min-w-0 flex-1">
                <div class="truncate font-semibold kura-text-main">{product.name}</div>
                <div class="text-[11px] kura-text-muted tabular-nums">
                  {qty} × {formatMoney(product.sell_price_minor, sym)}
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCartQty(product.sku, qty - 1)}
                  class="h-6 w-6 rounded-full kura-subtle text-[13px] font-bold kura-btn-press"
                >
                  −
                </button>
                <span class="tabular-nums font-bold kura-text-main min-w-14 text-right">
                  {formatMoney(lineTotal, sym)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modes & Discount */}
      <div class="flex items-center justify-between gap-2">
        <div class="inline-flex rounded-xl kura-subtle p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { paymentMode.value = m.id; }}
              class={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition kura-btn-press ${
                paymentMode.value === m.id
                  ? m.id === "DUE"
                    ? "bg-[#FF9500] text-white shadow-xs"
                    : "kura-card kura-text-main shadow-xs"
                  : "kura-text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[11px] kura-text-muted font-medium">Disc:</span>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={discInput}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setDiscInput(v);
              discountMinor.value = parseMoneyInput(v);
            }}
            class="w-16 rounded-lg kura-input px-2 py-1 text-right text-[12px] tabular-nums"
          />
          {count > 0 && (
            <button
              type="button"
              onClick={() => { clearCart(); setDiscInput(""); }}
              class="text-[11px] font-semibold text-[#FF3B30] px-1 hover:underline kura-btn-press"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {paymentMode.value === "DUE" && <DueCustomerPicker />}

      {/* Cart Summary & Action Buttons */}
      <div class="flex items-center justify-between gap-2">
        <div
          class="min-w-0 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
          title="Tap to toggle item list"
        >
          <div class="text-[11px] font-medium kura-text-muted tabular-nums flex items-center gap-1">
            <span>{count} {count === 1 ? "item" : "items"}</span>
            <span class="lg:hidden text-[10px] text-[#007AFF] font-bold">{expanded ? "▲ Hide" : "▼ Review"}</span>
            {discountMinor.value > 0 && (
              <span>· Sub {formatMoney(cartSubtotalMinor.value, sym)}</span>
            )}
          </div>
          <div class="text-[22px] font-bold tracking-tight kura-text-main tabular-nums leading-tight">
            {formatMoney(cartTotalMinor.value, sym)}
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            disabled={count === 0 || issuing}
            onClick={handleHold}
            title="Hold / Park Cart (F6)"
            class="rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/12 px-3 py-2.5 text-[12px] font-bold text-[#B25E00] dark:text-[#FF9500] hover:bg-[#FF9500]/20 disabled:opacity-35 transition kura-btn-press"
          >
            Hold
          </button>
          <button
            type="button"
            disabled={count === 0 || issuing}
            onClick={handleCharge}
            class="rounded-xl bg-[#34C759] hover:bg-[#2EB84E] px-4 py-2.5 text-[14px] font-bold text-white shadow-sm disabled:opacity-40 transition kura-btn-press"
          >
            {issuing ? "Issuing…" : "Charge & Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
