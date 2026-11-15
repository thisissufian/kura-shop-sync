import { useMemo, useState } from "preact/hooks";
import {
  cart,
  currencySymbol,
  formatMoney,
  products,
  setCartQty,
  showToast,
} from "../../state/kuraStore";
import { tryOpenBillByScan } from "../../state/parkedCarts";
import { scannerMode } from "../../state/uiSignals";
import { CheckoutPanel } from "../components/CheckoutPanel";
import { ParkedCartsBar } from "../components/ParkedCartsBar";
import { IconBarcodeScan, IconSearch } from "../primitives/KuraIcons";

export function CounterView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const list = products.value;
  const sym = currencySymbol.value;
  const cartMap = cart.value;

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const p of list) set.add(p.category || "General");
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
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, query, category]);

  const handleScanEnter = async (e: Event) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    if (await tryOpenBillByScan(query)) {
      setQuery("");
      return;
    }
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
    <div class="lg:grid lg:grid-cols-[1fr_360px] lg:gap-5 lg:items-start pb-44 lg:pb-6">
      <div class="space-y-3">
        <ParkedCartsBar />

        {/* Counter Search with inline Cam Scan button */}
        <form onSubmit={handleScanEnter} class="relative flex items-center">
          <IconSearch class="absolute left-3.5 w-4 h-4 text-[#86868B] pointer-events-none" />
          <input
            id="kura-counter-search"
            type="search"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search item, SKU, brand, or scan barcode (Enter)…"
            class="w-full rounded-[14px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] pl-10 pr-12 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#AEAEB2] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
          <button
            type="button"
            onClick={() => { scannerMode.value = "BARCODE_CART"; }}
            title="Open camera barcode scanner"
            class="absolute right-2 p-1.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-[#007AFF] hover:bg-[#007AFF]/15 kura-btn-press"
          >
            <IconBarcodeScan class="w-4 h-4" />
          </button>
        </form>

        {/* Category Filter Pills */}
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => {
            const active = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                class={`shrink-0 rounded-full px-3.5 py-1 text-[12px] font-semibold transition kura-btn-press ${
                  active
                    ? "bg-[#007AFF] text-white shadow-xs"
                    : "kura-card text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid with in-cart highlight */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((p) => {
            const inCart = (cartMap[p.sku] ?? 0);
            const isOut = p.stock_qty <= 0;
            const isLow = !isOut && p.stock_qty <= p.low_stock_threshold;
            const stockTone = isOut
              ? "bg-[#FF3B30]/12 text-[#FF3B30]"
              : isLow
                ? "bg-[#FF9500]/14 text-[#B25E00] dark:text-[#FF9500]"
                : "bg-[#34C759]/12 text-[#1E8E3E] dark:text-[#34C759]";

            return (
              <div
                key={p.sku}
                class={`kura-card p-3.5 transition ${
                  inCart > 0
                    ? "border-[#007AFF] ring-1 ring-[#007AFF]/30 shadow-md bg-white dark:bg-[#242426]"
                    : ""
                }`}
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-[#007AFF]">
                      {p.brand && <span>{p.brand} ·</span>}
                      <span class="text-[#86868B]">{p.category}</span>
                    </div>
                    <div class="truncate text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
                      {p.name}
                    </div>
                    <div class="text-[10px] font-mono text-[#AEAEB2] tabular-nums mt-0.5">
                      {p.sku} {p.variant ? `· ${p.variant}` : ""}
                    </div>
                  </div>

                  <div class="flex flex-col items-end gap-1 shrink-0">
                    {inCart > 0 && (
                      <span class="rounded-full bg-[#007AFF] text-white px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-xs">
                        {inCart} in cart
                      </span>
                    )}
                    <span class={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${stockTone}`}>
                      {isOut ? "Out" : `${p.stock_qty} left`}
                    </span>
                  </div>
                </div>

                <div class="mt-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                  <span class="text-[17px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                    {formatMoney(p.sell_price_minor, sym)}
                  </span>

                  <div class="flex items-center gap-1.5">
                    {inCart > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCartQty(p.sku, inCart - 1)}
                          class="h-8 w-8 rounded-full bg-black/[0.06] dark:bg-white/[0.08] text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center kura-btn-press"
                        >
                          −
                        </button>
                        <span class="w-6 text-center text-[13px] font-bold tabular-nums">
                          {inCart}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => setCartQty(p.sku, inCart + 1)}
                      class="h-8 rounded-full bg-[#007AFF] hover:bg-[#0062CC] px-3.5 text-[13px] font-bold text-white disabled:opacity-40 shadow-xs flex items-center justify-center kura-btn-press"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating / Sticky Checkout Panel */}
      <div class="fixed inset-x-0 bottom-16 z-30 px-3 pb-2 pt-1 lg:static lg:p-0 lg:sticky lg:top-24">
        <CheckoutPanel />
      </div>
    </div>
  );
}
