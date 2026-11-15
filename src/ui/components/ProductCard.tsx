import { useState } from "preact/hooks";
import { formatMoney } from "../../state/ipcBridge";
import type { Product } from "../../types/kura";
import { IconCart, IconEdit, IconSliders } from "../primitives/KuraIcons";

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
  const [showAdjust, setShowAdjust] = useState(false);
  const isOut = p.stock_qty <= 0;
  const isLow = !isOut && p.stock_qty <= p.low_stock_threshold;
  const marginMinor = p.sell_price_minor - p.cost_price_minor;

  const stockBadgeClass = isOut
    ? "bg-[#FF3B30]/12 text-[#FF3B30] border-[#FF3B30]/20"
    : isLow
      ? "bg-[#FF9500]/12 text-[#B25E00] dark:text-[#FF9500] border-[#FF9500]/25"
      : "bg-[#34C759]/12 text-[#1E8E3E] dark:text-[#34C759] border-[#34C759]/25";

  const monogram = (p.brand || p.name).slice(0, 2).toUpperCase();

  return (
    <div class="kura-card p-4 transition hover:shadow-md space-y-3">
      {/* Top Row: Brand, Category micro-pill & Stock Status */}
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[11px] font-bold text-[#007AFF] uppercase tracking-wide truncate">
            {p.brand || "GENERIC"}
          </span>
          <span class="rounded-md bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-[#86868B] uppercase font-semibold">
            {p.category}
          </span>
        </div>
        <span class={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums ${stockBadgeClass}`}>
          {isOut ? "Out of Stock" : `${p.stock_qty} in stock`}
        </span>
      </div>

      {/* Middle Row: Monogram Avatar & Product Details */}
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-12 h-12 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center font-bold text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] shrink-0 tracking-wider">
          {monogram}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-snug">
            {p.name}
          </h4>
          <div class="text-[11px] text-[#86868B] truncate mt-0.5">
            {p.variant ? `${p.variant} · ` : ""}
            {p.warranty_label && p.warranty_label !== "No Warranty (ওয়ারেন্টি নেই)" ? `🛡 ${p.warranty_label}` : "Standard Retail"}
          </div>
          <div class="text-[10px] font-mono text-[#86868B]/80 mt-0.5">
            SKU: {p.sku} {p.barcode ? `· ${p.barcode}` : ""}
          </div>
        </div>
      </div>

      {/* Bottom Row: Price & Actions */}
      <div class="pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-end justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[19px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-none">
            {formatMoney(p.sell_price_minor, sym)}
          </div>
          {isOwner && (
            <div class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 truncate">
              Cost: {formatMoney(p.cost_price_minor, sym)} · Margin: {formatMoney(marginMinor, sym)}
            </div>
          )}
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setShowAdjust(!showAdjust)}
                title="Quick Stock Adjust"
                class="w-9 h-9 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.12] kura-btn-press"
              >
                <IconSliders class="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(p)}
                title="Edit Product"
                class="w-9 h-9 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center justify-center hover:bg-black/[0.08] dark:hover:bg-white/[0.12] kura-btn-press"
              >
                <IconEdit class="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onSell(p.sku)}
            disabled={isOut}
            class="bg-[#007AFF] hover:bg-[#0062CC] text-white font-semibold px-3.5 py-2 rounded-xl text-[12px] shadow-xs flex items-center gap-1.5 disabled:opacity-40 kura-btn-press"
          >
            <IconCart class="w-3.5 h-3.5 text-white" />
            <span>Sell</span>
          </button>
        </div>
      </div>

      {/* Quick stock stepper flyout (Owner only) */}
      {showAdjust && isOwner && (
        <div class="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-between text-[11px]">
          <span class="text-[#86868B] font-medium">Quick Adjust:</span>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRestock(p.sku, -1)}
              class="px-2 py-0.5 rounded-md bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[#FF3B30] kura-btn-press"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => onRestock(p.sku, 1)}
              class="px-2 py-0.5 rounded-md bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[#34C759] kura-btn-press"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => onRestock(p.sku, 10)}
              class="px-2.5 py-0.5 rounded-md bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[#007AFF] kura-btn-press"
            >
              +10
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
