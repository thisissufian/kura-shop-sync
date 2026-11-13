import { formatMoney } from "../../state/ipcBridge";
import type { Product } from "../../types/kura";

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
  isOwner: boolean;
  onSell: (sku: string) => void;
  onEdit: (p: Product) => void;
  onRestock: (sku: string, delta: number) => void;
}

export function ProductCard({
  product: p,
  currencySymbol: sym,
  isOwner,
  onSell,
  onEdit,
  onRestock,
}: ProductCardProps) {
  const isOut = p.stock_qty <= 0;
  const isLow = !isOut && p.stock_qty <= p.low_stock_threshold;
  const marginMinor = p.sell_price_minor - p.cost_price_minor;

  const stockBadgeClass = isOut
    ? "bg-[#FF3B30]/12 text-[#FF3B30] border-[#FF3B30]/20"
    : isLow
      ? "bg-[#FF9500]/12 text-[#B25E00] dark:text-[#FF9500] border-[#FF9500]/25"
      : "bg-[#34C759]/12 text-[#1E8E3E] dark:text-[#34C759] border-[#34C759]/25";

  return (
    <div class="rounded-[18px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-3.5 shadow-xs transition hover:shadow-md space-y-2.5">
      {/* Top badges: Brand, Category/Variant & Stock Status */}
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0">
          {p.brand && (
            <span class="rounded-md bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 text-[11px] font-semibold tracking-tight">
              {p.brand}
            </span>
          )}
          <span class="rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-[#86868B] px-1.5 py-0.5 text-[11px]">
            {p.category} {p.variant ? `· ${p.variant}` : ""}
          </span>
          {p.warranty_label && p.warranty_label !== "No Warranty (ওয়ারেন্টি নেই)" && (
            <span class="rounded-md bg-[#34C759]/10 text-[#1E8E3E] dark:text-[#34C759] px-1.5 py-0.5 text-[10px] font-medium">
              🛡 {p.warranty_label}
            </span>
          )}
        </div>
        <span class={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${stockBadgeClass}`}>
          {isOut ? "Out of Stock" : `${p.stock_qty} in stock`}
        </span>
      </div>

      {/* Product Title & SKU */}
      <div class="min-w-0">
        <h4 class="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight">
          {p.name}
        </h4>
        <div class="text-[11px] font-mono text-[#86868B] mt-0.5">
          SKU: {p.sku} {p.barcode ? `· ${p.barcode}` : ""}
        </div>
      </div>

      {/* Pricing: Sell Price & Owner-Only Cost/Margin Strip */}
      <div class="pt-1 border-t border-black/[0.05] dark:border-white/[0.06] flex items-baseline justify-between">
        <div>
          <div class="text-[18px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
            {formatMoney(p.sell_price_minor, sym)}
          </div>
          {isOwner && (
            <div class="text-[11px] font-medium text-[#1E8E3E] dark:text-[#34C759] tabular-nums">
              Cost: {formatMoney(p.cost_price_minor, sym)} · Margin: {formatMoney(marginMinor, sym)}
            </div>
          )}
        </div>

        {/* Quick inline restock buttons (owner only) */}
        {isOwner && (
          <div class="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onRestock(p.sku, 1)}
              title="Restock +1"
              class="h-7 px-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] active:scale-95 transition"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => onRestock(p.sku, 10)}
              title="Restock +10"
              class="h-7 px-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] active:scale-95 transition"
            >
              +10
            </button>
          </div>
        )}
      </div>

      {/* Action Row: Edit & 1-tap Sell */}
      <div class="flex items-center gap-2 pt-1">
        {isOwner && (
          <button
            type="button"
            onClick={() => onEdit(p)}
            class="flex-1 py-2 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.04] active:scale-98 transition"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => onSell(p.sku)}
          disabled={isOut}
          class="flex-2 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-40 text-white text-[13px] font-bold shadow-xs active:scale-98 transition flex items-center justify-center gap-1.5"
        >
          <span>🛒</span>
          <span>Sell</span>
        </button>
      </div>
    </div>
  );
}
