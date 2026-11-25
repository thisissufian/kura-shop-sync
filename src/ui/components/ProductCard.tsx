import { useState } from "preact/hooks";
import { formatMoney } from "../../state/ipcBridge";
import type { Product } from "../../types/kura";
import { StockStatus } from "../primitives/Controls";
import { IconEdit, IconSliders } from "../primitives/KuraIcons";

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
  isOwner: boolean;
  onSell: (sku: string) => void;
  onEdit: (p: Product) => void;
  onRestock: (sku: string, delta: number) => void;
}

const NO_WARRANTY = "No Warranty (ওয়ারেন্টি নেই)";

/** One product as a grouped-list row (rendered inside a .kura-group). */
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
  const marginMinor = p.sell_price_minor - p.cost_price_minor;
  const monogram = (p.brand || p.name).slice(0, 2).toUpperCase();
  const meta = [p.brand, p.variant, p.category].filter(Boolean).join(" · ");
  const warranty = p.warranty_label && p.warranty_label !== NO_WARRANTY ? p.warranty_label : "";

  return (
    <div class="kura-row !items-start !py-3">
      <div class="mt-0.5 w-10 h-10 rounded-[9px] bg-fill flex items-center justify-center text-caption font-semibold text-label-2 shrink-0">
        {monogram}
      </div>

      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-body text-label truncate">{p.name}</div>
            <div class="text-footnote text-label-2 truncate">{meta}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-body font-semibold tabular-nums text-label">{formatMoney(p.sell_price_minor, sym)}</div>
            {isOwner && (
              <div class="text-caption tabular-nums text-label-2">
                cost {formatMoney(p.cost_price_minor, sym)}
              </div>
            )}
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 text-footnote truncate">
            <StockStatus p={p} />
            {isOwner && <span class="hidden sm:inline text-label-2 tabular-nums"> · margin {formatMoney(marginMinor, sym)}</span>}
            {warranty && <span class="text-label-2 hidden sm:inline"> · {warranty}</span>}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <>
                <button type="button" onClick={() => setShowAdjust(!showAdjust)} title="Adjust stock" aria-label="Adjust stock"
                  aria-pressed={showAdjust} class={`kura-icon-btn !w-8 !h-8 ${showAdjust ? "!bg-tint !text-white" : ""}`}>
                  <IconSliders class="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onEdit(p)} title="Edit product" aria-label="Edit product"
                  class="kura-icon-btn !w-8 !h-8">
                  <IconEdit class="w-4 h-4" />
                </button>
              </>
            )}
            <button type="button" onClick={() => onSell(p.sku)} disabled={isOut} class="kura-btn kura-btn-gray kura-btn-sm">
              Sell
            </button>
          </div>
        </div>

        {showAdjust && isOwner && (
          <div class="flex items-center justify-between gap-2 pt-1">
            <span class="text-footnote text-label-2">Adjust stock</span>
            <div class="flex items-center gap-1.5">
              {[-1, 1, 10].map((d) => (
                <button key={d} type="button" onClick={() => onRestock(p.sku, d)}
                  class={`kura-btn kura-btn-sm !min-h-[30px] tabular-nums ${d < 0 ? "kura-btn-destructive" : "kura-btn-gray"}`}>
                  {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
