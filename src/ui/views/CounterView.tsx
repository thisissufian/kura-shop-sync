import { useMemo, useState } from "preact/hooks";
import {
  cart,
  cartCount,
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
import { ChipRow, QtyStepper, SearchField, StockStatus } from "../primitives/Controls";
import { PageHeader } from "../primitives/Group";

export function CounterView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const list = products.value;
  const sym = currencySymbol.value;
  const cartMap = cart.value;
  const count = cartCount.value;

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
    <div class="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start pb-64 lg:pb-6">
      <div class="space-y-4">
        <PageHeader title="Register" subtitle={count > 0 ? `${count} ${count === 1 ? "item" : "items"} in this sale` : "Search, scan or tap to add"} />
        <ParkedCartsBar />

        <form onSubmit={handleScanEnter}>
          <SearchField
            id="kura-counter-search"
            value={query}
            onInput={setQuery}
            placeholder="Search or scan a barcode"
            onScan={() => { scannerMode.value = "BARCODE_CART"; }}
          />
        </form>

        <ChipRow items={categories} value={category} onChange={setCategory} />

        <div class="kura-group">
          {filtered.map((p) => {
            const inCart = cartMap[p.sku] ?? 0;
            const isOut = p.stock_qty <= 0;
            return (
              <div key={p.sku} class="kura-row !py-2.5">
                <div class="min-w-0 flex-1">
                  <div class="text-body text-label truncate">{p.name}</div>
                  <div class="flex items-center gap-1.5 text-footnote text-label-2 min-w-0">
                    <span class="sm:hidden font-semibold text-label tabular-nums shrink-0">{formatMoney(p.sell_price_minor, sym)}</span>
                    <span class="hidden sm:inline truncate">{[p.brand, p.variant].filter(Boolean).join(" · ") || p.category}</span>
                    <span class="shrink-0">·</span>
                    <span class="shrink-0"><StockStatus p={p} /></span>
                  </div>
                </div>
                <div class="hidden sm:block text-body font-semibold tabular-nums text-label shrink-0">
                  {formatMoney(p.sell_price_minor, sym)}
                </div>
                {inCart > 0 ? (
                  <QtyStepper qty={inCart} onChange={(q) => setCartQty(p.sku, q)} canAdd={!isOut} />
                ) : (
                  <button type="button" disabled={isOut} onClick={() => setCartQty(p.sku, 1)}
                    class="kura-btn kura-btn-gray kura-btn-sm w-[86px] shrink-0 !font-semibold">
                    Add
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div class="kura-row justify-center text-subhead text-label-2 py-8">No products match “{query}”.</div>
          )}
        </div>
      </div>

      <div class="fixed inset-x-0 z-30 px-2 bottom-[calc(50px+max(0.75rem,env(safe-area-inset-bottom)))] lg:sticky lg:bottom-auto lg:inset-x-auto lg:px-0 lg:top-[68px] lg:pt-[58px]">
        <CheckoutPanel />
      </div>
    </div>
  );
}
