import { computed } from "@preact/signals";
import {
  adjustProductStock,
  currencySymbol,
  editingProduct,
  formatMoney,
  isOwner,
  products,
  productSheetOpen,
} from "../../state/kuraStore";
import { scannerMode } from "../../state/uiSignals";

const inventoryStats = computed(() => {
  let retailMinor = 0;
  let costMinor = 0;
  let lowCount = 0;
  for (const p of products.value) {
    const qty = Math.max(0, p.stock_qty);
    retailMinor += p.sell_price_minor * qty;
    costMinor += p.cost_price_minor * qty;
    if (p.stock_qty <= p.low_stock_threshold) lowCount += 1;
  }
  return { retailMinor, costMinor, profitMinor: retailMinor - costMinor, lowCount };
});

export function KuraVaultView() {
  const sym = currencySymbol.value;
  const owner = isOwner.value;
  const stats = inventoryStats.value;
  const list = products.value;

  return (
    <div class="space-y-4 pb-8">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-[18px] font-bold tracking-tight text-[#1D1D1F]">Kura Vault</h2>
          <p class="text-[12px] text-[#86868B] tabular-nums">
            {list.length} SKUs · {stats.lowCount} low-stock alert(s)
          </p>
        </div>
        {owner && (
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                scannerMode.value = "BARCODE_PREFILL";
              }}
              class="rounded-[12px] bg-[#007AFF]/10 px-3 py-2 text-[13px] font-semibold text-[#007AFF] active:scale-95 transition"
            >
              Scan New
            </button>
            <button
              type="button"
              onClick={() => {
                editingProduct.value = null;
                productSheetOpen.value = true;
              }}
              class="rounded-[12px] bg-[#007AFF] px-3.5 py-2 text-[13px] font-semibold text-white shadow-xs active:scale-95 transition"
            >
              + New Product
            </button>
          </div>
        )}
      </div>

      {owner ? (
        <div class="grid grid-cols-3 gap-2.5">
          <div class="rounded-[14px] border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div class="text-[11px] font-medium text-[#86868B]">Retail Value</div>
            <div class="mt-1 text-[16px] font-bold text-[#1D1D1F] tabular-nums">
              {formatMoney(stats.retailMinor, sym)}
            </div>
          </div>
          <div class="rounded-[14px] border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div class="text-[11px] font-medium text-[#86868B]">Cost Basis</div>
            <div class="mt-1 text-[16px] font-bold text-[#1D1D1F] tabular-nums">
              {formatMoney(stats.costMinor, sym)}
            </div>
          </div>
          <div class="rounded-[14px] border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div class="text-[11px] font-medium text-[#86868B]">Est. Margin</div>
            <div class="mt-1 text-[16px] font-bold text-[#34C759] tabular-nums">
              {formatMoney(stats.profitMinor, sym)}
            </div>
          </div>
        </div>
      ) : (
        <div class="rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 text-[12px] text-[#86868B]">
          Cashier Mode active: cost prices, profit margins, and catalog editing are locked.
        </div>
      )}

      <div class="space-y-2.5">
        {list.map((p) => {
          const isOut = p.stock_qty <= 0;
          const isLow = p.stock_qty <= p.low_stock_threshold;
          return (
            <div
              key={p.sku}
              class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-[15px] font-semibold text-[#1D1D1F]">
                    {p.name}
                  </span>
                  <span
                    class={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isOut
                        ? "bg-[#FF3B30]/12 text-[#FF3B30]"
                        : isLow
                          ? "bg-[#FF9500]/14 text-[#B25E00]"
                          : "bg-[#34C759]/12 text-[#1E8E3E]"
                    }`}
                  >
                    {p.stock_qty} in stock
                  </span>
                </div>
                <div class="mt-1 text-[12px] text-[#86868B] tabular-nums">
                  {p.sku} · {p.category} · Sell {formatMoney(p.sell_price_minor, sym)}
                  {owner ? ` · Cost ${formatMoney(p.cost_price_minor, sym)}` : ""}
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustProductStock(p.sku, -1, "Quick Adjust")}
                  class="rounded-[9px] bg-black/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-[#1D1D1F] tabular-nums active:scale-95"
                >
                  −1
                </button>
                <button
                  type="button"
                  onClick={() => adjustProductStock(p.sku, 1, "Quick Restock")}
                  class="rounded-[9px] bg-[#34C759]/12 px-2.5 py-1.5 text-[12px] font-semibold text-[#1E8E3E] tabular-nums active:scale-95"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => adjustProductStock(p.sku, 10, "Case Restock")}
                  class="rounded-[9px] bg-[#007AFF]/12 px-2.5 py-1.5 text-[12px] font-semibold text-[#007AFF] tabular-nums active:scale-95"
                >
                  +10
                </button>
                {owner && (
                  <button
                    type="button"
                    onClick={() => {
                      editingProduct.value = p;
                      productSheetOpen.value = true;
                    }}
                    class="rounded-[9px] border border-black/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] active:scale-95"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
