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

export function CheckoutPanel() {
  const [discInput, setDiscInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const sym = currencySymbol.value;
  const lines = cartLines.value;
  const count = cartCount.value;

  const handleCharge = async () => {
    setIssuing(true);
    const res = await chargeAndIssueBill();
    if (res) setDiscInput("");
    setIssuing(false);
  };

  return (
    <div class="rounded-[18px] border border-black/[0.06] bg-white/90 backdrop-blur-xl p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] space-y-3">
      {lines.length > 0 && (
        <div class="hidden lg:block max-h-56 overflow-y-auto space-y-2 border-b border-black/[0.06] pb-3">
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
          {(["CASH", "CARD", "UPI"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                paymentMode.value = mode;
              }}
              class={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition ${
                paymentMode.value === mode
                  ? "bg-white text-[#1D1D1F] shadow-xs"
                  : "text-[#86868B]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div class="flex items-center gap-1.5">
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
            class="w-16 rounded-[8px] border border-black/[0.08] bg-[#F5F5F7] px-2 py-1 text-right text-[12px] tabular-nums"
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
