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
import { QtyStepper } from "../primitives/Controls";
import { IconChevronDown } from "../primitives/KuraIcons";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { DueCustomerPicker } from "./DueCustomerPicker";

const MODES = [
  { id: "CASH" as const, label: "Cash" },
  { id: "WALLET" as const, label: "Wallet / QR" },
  { id: "DUE" as const, label: "Due" },
];

/** Current sale. A material bar above the tab bar on phones, a grouped panel on desktop. */
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
    <div class="rounded-[18px] kura-glass-bar shadow-[0_8px_40px_rgba(0,0,0,0.14)] ring-[0.5px] ring-sep p-3 space-y-3 lg:bg-surface lg:shadow-none lg:ring-0 lg:p-4 lg:backdrop-blur-none">
      <div class="hidden lg:flex items-baseline justify-between">
        <h2 class="text-title3 font-semibold text-label">Current sale</h2>
        {count > 0 && (
          <button type="button" onClick={() => { clearCart(); setDiscInput(""); }} class="text-subhead text-danger">
            Clear
          </button>
        )}
      </div>

      {lines.length > 0 && (
        <div class={`${expanded ? "block" : "hidden lg:block"} max-h-56 lg:max-h-[42vh] overflow-y-auto -mx-1 px-1`}>
          {lines.map(({ product, qty, lineTotal }, i) => (
            <div key={product.sku} class={`flex items-center gap-3 py-2 ${i > 0 ? "kura-hairline-t" : ""}`}>
              <div class="min-w-0 flex-1">
                <div class="text-subhead text-label truncate">{product.name}</div>
                <div class="text-footnote text-label-2 tabular-nums">
                  {qty} × {formatMoney(product.sell_price_minor, sym)}
                </div>
              </div>
              <span class="text-subhead font-semibold tabular-nums text-label">{formatMoney(lineTotal, sym)}</span>
              <QtyStepper qty={qty} onChange={(q) => setCartQty(product.sku, q)} canAdd={product.stock_qty > qty} />
            </div>
          ))}
        </div>
      )}

      <SegmentedControl options={MODES} value={paymentMode.value} onChange={(m) => { paymentMode.value = m; }} />

      {paymentMode.value === "DUE" && <DueCustomerPicker />}

      <div class="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setExpanded(!expanded)} disabled={count === 0}
          class="flex items-center gap-1 text-subhead text-label-2 tabular-nums lg:pointer-events-none" aria-expanded={expanded}>
          <span>{count} {count === 1 ? "item" : "items"}</span>
          {discountMinor.value > 0 && <span>· subtotal {formatMoney(cartSubtotalMinor.value, sym)}</span>}
          {count > 0 && <IconChevronDown class={`w-4 h-4 text-tint lg:hidden transition-transform ${expanded ? "rotate-180" : ""}`} />}
        </button>
        <div class="flex items-center gap-2">
          {count > 0 && (
            <button type="button" onClick={() => { clearCart(); setDiscInput(""); }} class="text-subhead text-danger lg:hidden">
              Clear
            </button>
          )}
          <label class="flex items-center gap-1.5 text-subhead text-label-2">
            Discount
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={discInput}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setDiscInput(v);
                discountMinor.value = parseMoneyInput(v);
              }}
              class="kura-input w-20 h-8 px-2 text-right text-subhead tabular-nums"
            />
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <button type="button" disabled={count === 0 || issuing} onClick={handleHold} title="Hold this sale (F6)"
          class="kura-btn kura-btn-gray kura-btn-lg px-5">
          Hold
        </button>
        <button type="button" disabled={count === 0 || issuing} onClick={handleCharge}
          class="kura-btn kura-btn-filled kura-btn-lg flex-1 justify-between px-5">
          <span>{issuing ? "Charging…" : "Charge"}</span>
          <span class="tabular-nums">{formatMoney(cartTotalMinor.value, sym)}</span>
        </button>
      </div>
    </div>
  );
}
