import { currencySymbol, formatMoney, products } from "../../state/kuraStore";
import { discardParkedCart, parkedCarts, resumeParkedCart } from "../../state/parkedCarts";
import { IconXmark } from "../primitives/KuraIcons";

/** Held sales: a row of capsules. Tap to resume, × to discard. */
export function ParkedCartsBar() {
  const list = parkedCarts.value;
  if (list.length === 0) return null;

  const catalog = products.value;
  const sym = currencySymbol.value;

  const calcSummary = (items: Record<string, number>, disc: number) => {
    let count = 0;
    let sub = 0;
    for (const [sku, qty] of Object.entries(items)) {
      count += qty;
      const p = catalog.find((x) => x.sku === sku);
      if (p) sub += p.sell_price_minor * qty;
    }
    return { count, total: Math.max(0, sub - Math.min(disc, sub)) };
  };

  return (
    <div>
      <div class="kura-section-header">On hold · {list.length} of 5</div>
      <div class="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
        {list.map((p) => {
          const { count, total } = calcSummary(p.items, p.discountMinor);
          return (
            <div key={p.id} class="shrink-0 inline-flex items-center rounded-full bg-surface h-9 pl-3.5 pr-1 gap-1">
              <button type="button" onClick={() => resumeParkedCart(p.id)} title="Resume this sale"
                class="flex items-center gap-2 text-left active:opacity-60">
                <span class="kura-dot text-warning-fill" />
                <span class="max-w-[110px] truncate text-subhead font-medium text-label">{p.customerName || p.label}</span>
                <span class="text-subhead text-label-2 tabular-nums">{count} · {formatMoney(total, sym)}</span>
              </button>
              <button type="button" onClick={() => discardParkedCart(p.id)} title="Discard held sale" aria-label="Discard held sale"
                class="h-7 w-7 flex items-center justify-center rounded-full text-label-2 active:bg-fill">
                <IconXmark class="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
