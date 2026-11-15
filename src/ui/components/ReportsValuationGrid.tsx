import { formatMoney } from "../../state/ipcBridge";
import { khataSheetOpen, supplierSheetOpen } from "../../state/uiSignals";
import type { OwnerAnalytics } from "../../types/kura";
import {
  IconBox,
  IconTrendUp,
  IconTruckSupplier,
  IconUsersDue,
} from "../primitives/KuraIcons";

interface Props {
  d: OwnerAnalytics | null;
  sym: string;
}

export function ReportsValuationGrid({ d, sym }: Props) {
  return (
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <div class="kura-card p-3.5 flex flex-col justify-between">
        <div class="flex items-start justify-between">
          <span class="text-[11px] font-semibold kura-text-muted">Inventory Cost</span>
          <div class="kura-icon-squircle bg-[#007AFF]/12 text-[#007AFF]">
            <IconBox class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2">
          <div class="text-[18px] font-bold kura-text-main tabular-nums">
            {formatMoney(d?.inventory_cost_value_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] kura-text-muted tabular-nums">
            {d?.total_inventory_units ?? 0} Total Units
          </div>
        </div>
      </div>

      <div class="kura-card p-3.5 flex flex-col justify-between">
        <div class="flex items-start justify-between">
          <span class="text-[11px] font-semibold kura-text-muted">Retail Value</span>
          <div class="kura-icon-squircle bg-[#34C759]/12 text-[#34C759]">
            <IconTrendUp class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2">
          <div class="text-[18px] font-bold kura-text-main tabular-nums">
            {formatMoney(d?.retail_market_value_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] kura-text-muted truncate">
            Projected sales value
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { khataSheetOpen.value = true; }}
        class="kura-card p-3.5 text-left flex flex-col justify-between hover:border-[#FF9500]/40 transition kura-btn-press"
      >
        <div class="flex items-start justify-between">
          <span class="text-[11px] font-semibold kura-text-muted">Customer Dues</span>
          <div class="kura-icon-squircle bg-[#FF9500]/12 text-[#FF9500]">
            <IconUsersDue class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2">
          <div class="text-[18px] font-bold text-[#FF9500] tabular-nums">
            {formatMoney(d?.customer_receivables_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] kura-text-muted">Customer dues ledger ➔</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => { supplierSheetOpen.value = true; }}
        class="kura-card p-3.5 text-left flex flex-col justify-between hover:border-[#AF52DE]/40 transition kura-btn-press"
      >
        <div class="flex items-start justify-between">
          <span class="text-[11px] font-semibold kura-text-muted">Supplier Payables</span>
          <div class="kura-icon-squircle bg-[#AF52DE]/12 text-[#AF52DE]">
            <IconTruckSupplier class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2">
          <div class="text-[18px] font-bold text-[#AF52DE] tabular-nums">
            {formatMoney(d?.supplier_payables_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] kura-text-muted">Vendor dues ledger ➔</div>
        </div>
      </button>
    </div>
  );
}
