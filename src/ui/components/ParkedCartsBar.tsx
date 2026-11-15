import { currencySymbol, formatMoney, products } from "../../state/kuraStore";
import { discardParkedCart, parkedCarts, resumeParkedCart } from "../../state/parkedCarts";

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
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      <span class="shrink-0 text-[11px] font-semibold uppercase tracking-wide kura-text-muted">
        Held ({list.length}/5)
      </span>
      {list.map((p) => {
        const { count, total } = calcSummary(p.items, p.discountMinor);
        return (
          <div
            key={p.id}
            class="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#FF9500]/30 bg-[#FF9500]/10 pl-2.5 pr-1 py-1 shadow-xs"
          >
            <button
              type="button"
              onClick={() => resumeParkedCart(p.id)}
              title="Tap to restore parked cart"
              class="flex items-center gap-1.5 text-left"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-[#FF9500]" />
              <span class="max-w-[95px] truncate text-[12px] font-semibold kura-text-main">
                {p.customerName || p.label}
              </span>
              <span class="text-[11px] font-medium text-[#B25E00] dark:text-[#FF9500] tabular-nums">
                {count} · {formatMoney(total, sym)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => discardParkedCart(p.id)}
              title="Discard held cart"
              class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] kura-text-muted hover:bg-black/[0.08] dark:hover:bg-white/[0.08] hover:text-[#FF3B30]"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
