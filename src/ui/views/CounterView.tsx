import { useMemo, useState } from "preact/hooks";
import {
  cart,
  currencySymbol,
  formatMoney,
  products,
  setCartQty,
  showToast,
} from "../../state/kuraStore";
import { scannerMode } from "../../state/uiSignals";
import { CheckoutPanel } from "../components/CheckoutPanel";

export function CounterView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const list = products.value;
  const sym = currencySymbol.value;
  const cartMap = cart.value;

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const p of list) set.add(p.category);
    return Array.from(set);
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, query, category]);

  const handleScanEnter = (e: Event) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exact = list.find(
      (p) => p.sku.toLowerCase() === q || (p.barcode ?? "").toLowerCase() === q
    );
    if (exact) {
      setCartQty(exact.sku, (cartMap[exact.sku] ?? 0) + 1);
      setQuery("");
      showToast(`Added ${exact.name}`);
    } else if (filtered.length === 1) {
      const only = filtered[0];
      setCartQty(only.sku, (cartMap[only.sku] ?? 0) + 1);
      setQuery("");
    }
  };

  return (
    <div class="lg:grid lg:grid-cols-[1fr_340px] lg:gap-5 lg:items-start pb-40 lg:pb-6">
      <div class="space-y-3">
        <form onSubmit={handleScanEnter} class="flex gap-2">
          <input
            type="search"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search item, SKU, or scan barcode…"
            class="flex-1 rounded-[12px] border border-black/[0.07] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder-[#AEAEB2] shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus:border-[#007AFF] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              scannerMode.value = "BARCODE_CART";
            }}
            title="Open camera barcode scanner"
            class="rounded-[12px] bg-[#007AFF]/10 px-3.5 py-2.5 text-[13px] font-semibold text-[#007AFF] active:scale-95 transition"
          >
            Cam Scan
          </button>
        </form>

        <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => {
            const active = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                class={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                  active
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-white border border-black/[0.06] text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((p) => {
            const qty = cartMap[p.sku] ?? 0;
            const stockTone =
              p.stock_qty <= 0
                ? "bg-[#FF3B30]/12 text-[#FF3B30]"
                : p.stock_qty <= p.low_stock_threshold
                  ? "bg-[#FF9500]/14 text-[#B25E00]"
                  : "bg-[#34C759]/12 text-[#1E8E3E]";
            return (
              <div
                key={p.sku}
                class={`rounded-[14px] border bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition ${
                  qty > 0 ? "border-[#007AFF]/45 ring-1 ring-[#007AFF]/15" : "border-black/[0.06]"
                }`}
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="text-[11px] font-medium text-[#86868B]">{p.category}</div>
                    <div class="truncate text-[15px] font-semibold text-[#1D1D1F]">
                      {p.name}
                    </div>
                    <div class="mt-0.5 text-[11px] text-[#AEAEB2] tabular-nums">{p.sku}</div>
                  </div>
                  <span
                    class={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${stockTone}`}
                  >
                    {p.stock_qty} left
                  </span>
                </div>

                <div class="mt-3 flex items-center justify-between">
                  <span class="text-[17px] font-bold text-[#1D1D1F] tabular-nums">
                    {formatMoney(p.sell_price_minor, sym)}
                  </span>

                  <div class="flex items-center gap-1.5">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCartQty(p.sku, qty - 1)}
                          class="h-8 w-8 rounded-full bg-black/[0.06] text-[16px] font-semibold text-[#1D1D1F] active:scale-90 transition"
                        >
                          −
                        </button>
                        <span class="w-6 text-center text-[14px] font-semibold tabular-nums">
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setCartQty(p.sku, qty + 1)}
                      class="h-8 rounded-full bg-[#007AFF] px-3 text-[14px] font-semibold text-white active:scale-90 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div class="fixed inset-x-0 bottom-0 z-30 p-3 bg-white/80 backdrop-blur-xl border-t border-black/[0.06] lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0 lg:sticky lg:top-24">
        <CheckoutPanel />
      </div>
    </div>
  );
}
