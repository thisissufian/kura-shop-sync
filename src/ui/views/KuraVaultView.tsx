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
import { IconBarcodeScan, IconPlus, IconSearch } from "../primitives/KuraIcons";

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
    showToast("Added to cart · Jumped to Register");
  };

  return (
    <div class="space-y-4 pb-4">
      {/* Header & Primary Actions */}
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-[20px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            Kura Vault
          </h2>
          <p class="text-[12px] text-[#86868B] tabular-nums">
            {list.length} SKUs · {stats.lowCount} low-stock alert(s)
          </p>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { csvSheetOpen.value = true; }}
            class="kura-card px-3 py-2 text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] kura-btn-press"
          >
            CSV / Labels
          </button>
          {owner && (
            <button
              type="button"
              onClick={() => { editingProduct.value = null; productSheetOpen.value = true; }}
              class="rounded-xl bg-[#007AFF] hover:bg-[#0062CC] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs flex items-center gap-1 kura-btn-press"
            >
              <IconPlus class="w-4 h-4" />
              <span>New Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Valuation Strip (Owner Only) */}
      {owner && (
        <div class="grid grid-cols-3 gap-2.5">
          <div class="kura-card p-3 shadow-xs">
            <div class="text-[11px] font-medium text-[#86868B]">Retail Value</div>
            <div class="mt-0.5 text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {formatMoney(stats.retailMinor, sym)}
            </div>
          </div>
          <div class="kura-card p-3 shadow-xs">
            <div class="text-[11px] font-medium text-[#86868B]">Cost Basis</div>
            <div class="mt-0.5 text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {formatMoney(stats.costMinor, sym)}
            </div>
          </div>
          <div class="kura-card p-3 shadow-xs">
            <div class="text-[11px] font-medium text-[#86868B]">Est. Margin</div>
            <div class="mt-0.5 text-[16px] font-bold text-[#34C759] tabular-nums">
              {formatMoney(stats.profitMinor, sym)}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar with Camera Scan Button */}
      <div class="relative flex items-center">
        <IconSearch class="absolute left-3.5 w-4 h-4 text-[#86868B] pointer-events-none" />
        <input
          type="search"
          placeholder="Search by name, SKU, barcode, brand..."
          value={searchQuery.value}
          onInput={(e) => { searchQuery.value = (e.target as HTMLInputElement).value; }}
          class="w-full rounded-[14px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] pl-10 pr-12 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
        />
        <button
          type="button"
          onClick={() => { scannerMode.value = "BARCODE_PREFILL"; }}
          title="Scan barcode with camera"
          class="absolute right-2 p-1.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-[#007AFF] hover:bg-[#007AFF]/15 kura-btn-press"
        >
          <IconBarcodeScan class="w-4 h-4" />
        </button>
      </div>

      {/* Horizontally Scrollable Category Pills */}
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { selectedCategory.value = c; }}
            class={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition kura-btn-press ${
              selectedCategory.value === c
                ? "bg-[#007AFF] text-white shadow-xs"
                : "bg-black/[0.05] dark:bg-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Summary Bar */}
      <div class="flex items-center justify-between text-[11px] text-[#86868B] px-1">
        <span>{filtered.length} Products Found</span>
        <span class="tabular-nums">Total Stock: {stats.totalUnits} units</span>
      </div>

      {/* Product Cards Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>
      {filtered.length === 0 && (
        <div class="text-center py-12 text-[#86868B] text-[13px]">
          No products matched your search.
        </div>
      )}
    </div>
  );
}
