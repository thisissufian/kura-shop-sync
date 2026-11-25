import { computed, signal } from "@preact/signals";
import {
  activeTab,
  adjustProductStock,
  cart,
  currencySymbol,
  editingProduct,
  formatMoney,
  isOwner,
  products,
  productSheetOpen,
  setCartQty,
  showToast,
} from "../../state/kuraStore";
import { csvSheetOpen, scannerMode } from "../../state/uiSignals";
import { ProductCard } from "../components/ProductCard";
import { ChipRow, SearchField } from "../primitives/Controls";
import { PageHeader } from "../primitives/Group";
import { IconPlus } from "../primitives/KuraIcons";

const searchQuery = signal("");
const selectedCategory = signal("All");

const inventoryStats = computed(() => {
  let retailMinor = 0;
  let costMinor = 0;
  let lowCount = 0;
  let totalUnits = 0;
  for (const p of products.value) {
    const qty = Math.max(0, p.stock_qty);
    totalUnits += qty;
    retailMinor += p.sell_price_minor * qty;
    costMinor += p.cost_price_minor * qty;
    if (p.stock_qty <= p.low_stock_threshold) lowCount += 1;
  }
  return { retailMinor, costMinor, profitMinor: retailMinor - costMinor, lowCount, totalUnits };
});

export function KuraVaultView() {
  const sym = currencySymbol.value;
  const owner = isOwner.value;
  const stats = inventoryStats.value;
  const list = products.value;
  const q = searchQuery.value.trim().toLowerCase();
  const cat = selectedCategory.value;

  const categories = ["All", ...Array.from(new Set(list.map((p) => p.category || "General")))];

  const filtered = list.filter((p) => {
    const matchesCat = cat === "All" || p.category === cat;
    const matchesQ =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCat && matchesQ;
  });

  const handleSell = (sku: string) => {
    const cur = cart.value[sku] ?? 0;
    setCartQty(sku, cur + 1);
    activeTab.value = "counter";
    showToast("Added to the sale");
  };

  return (
    <div class="space-y-5 pb-4">
      <PageHeader title="Products" subtitle={`${list.length} products · ${stats.lowCount} low on stock`}>
        <button type="button" onClick={() => { csvSheetOpen.value = true; }} class="kura-btn kura-btn-gray kura-btn-sm">
          <span>Labels<span class="hidden sm:inline"> &amp; CSV</span></span>
        </button>
        {owner && (
          <button type="button" title="New product" aria-label="New product"
            onClick={() => { editingProduct.value = null; productSheetOpen.value = true; }}
            class="kura-icon-btn !bg-tint !text-white !w-8 !h-8">
            <IconPlus class="w-[18px] h-[18px] stroke-[2.2]" />
          </button>
        )}
      </PageHeader>

      {owner && (
        <div class="kura-group grid grid-cols-3">
          {[
            { k: "Retail value", v: stats.retailMinor, c: "text-label" },
            { k: "At cost", v: stats.costMinor, c: "text-label" },
            { k: "Est. margin", v: stats.profitMinor, c: "text-positive" },
          ].map((m, i) => (
            <div key={m.k} class={`px-4 py-3 min-w-0 ${i > 0 ? "border-l-[0.5px] border-sep" : ""}`}>
              <div class="text-caption text-label-2 truncate">{m.k}</div>
              <div class={`text-subhead font-semibold tabular-nums truncate ${m.c}`}>{formatMoney(m.v, sym)}</div>
            </div>
          ))}
        </div>
      )}

      <SearchField
        value={searchQuery.value}
        placeholder="Name, SKU, barcode or brand"
        onInput={(v) => { searchQuery.value = v; }}
        onScan={() => { scannerMode.value = "BARCODE_PREFILL"; }}
      />

      <ChipRow items={categories} value={cat} onChange={(c) => { selectedCategory.value = c; }} />

      <section>
        <div class="kura-section-header flex justify-between tabular-nums">
          <span>{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>
          <span>{stats.totalUnits} units in stock</span>
        </div>
        <div class="kura-group" style="--kura-sep-inset:68px">
          {filtered.map((p) => (
            <ProductCard
              key={p.sku}
              product={p}
              currencySymbol={sym}
              isOwner={owner}
              onSell={handleSell}
              onEdit={(prod) => { editingProduct.value = prod; productSheetOpen.value = true; }}
              onRestock={(sku, delta) => adjustProductStock(sku, delta, "Quick Restock")}
            />
          ))}
          {filtered.length === 0 && (
            <div class="kura-row justify-center py-8 text-subhead text-label-2">No products match your search.</div>
          )}
        </div>
      </section>
    </div>
  );
}
