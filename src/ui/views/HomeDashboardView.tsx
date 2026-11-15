import { useEffect, useState } from "preact/hooks";
import { callBackend, formatMoney } from "../../state/ipcBridge";
import {
  activeTab,
  currencySymbol,
  editingProduct,
  isOwner,
  products,
  productSheetOpen,
} from "../../state/kuraStore";
import { drawerSheetOpen, khataSheetOpen, supplierSheetOpen } from "../../state/uiSignals";
import type { OwnerAnalytics } from "../../types/kura";
import { HomeTrendChart } from "../components/HomeTrendChart";
import {
  IconBox,
  IconCart,
  IconPlus,
  IconRegister,
  IconTrendUp,
  IconTruckSupplier,
  IconUsersDue,
  IconWallet,
} from "../primitives/KuraIcons";

export function HomeDashboardView() {
  const sym = currencySymbol.value;
  const owner = isOwner.value;
  const prodList = products.value;
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);

  const fetchAnalytics = async () => {
    if (!owner) return;
    try {
      const data = await callBackend<OwnerAnalytics>("get_owner_analytics", { period: "TODAY" });
      setAnalytics(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, [owner, prodList.length]);

  const rev = analytics?.gross_revenue_minor ?? 0;
  const profit = analytics?.net_operating_profit_minor ?? 0;
  const exp = analytics?.operating_expenses_minor ?? 0;
  const costVal = analytics?.inventory_cost_value_minor ?? 0;
  const retVal = analytics?.retail_market_value_minor ?? 0;
  const custDue = analytics?.customer_receivables_minor ?? 0;
  const suppDue = analytics?.supplier_payables_minor ?? 0;
  const trend = analytics?.daily_trend ?? [];
  const maxTrendRev = Math.max(1, ...trend.map((t) => t.revenue_minor));

  return (
    <div class="space-y-4 pb-4">
      {/* 1. Hero Card: Today's Turnover */}
      <div class="kura-hero-card p-5 sm:p-6 overflow-hidden">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-white/70">
              Today's Net Turnover
            </span>
            <div class="text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums mt-1 leading-none">
              {formatMoney(rev, sym)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { activeTab.value = "counter"; }}
            class="rounded-full bg-white text-slate-900 font-semibold px-4 py-2 text-[12px] shadow-sm kura-btn-press flex items-center gap-1.5"
          >
            <IconCart class="w-4 h-4 text-slate-900" />
            <span>New Sale</span>
          </button>
        </div>

        {owner && (
          <div class="mt-4 pt-3.5 border-t border-white/15 grid grid-cols-3 gap-2 text-left">
            <div>
              <div class="text-[10px] text-white/70 uppercase font-medium">Est. Net Profit</div>
              <div class="text-[14px] sm:text-[15px] font-bold text-[#4ADE80] tabular-nums">
                {formatMoney(profit, sym)}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-white/70 uppercase font-medium">Today's Expenses</div>
              <div class="text-[14px] sm:text-[15px] font-bold text-[#FDBA74] tabular-nums">
                {formatMoney(exp, sym)}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-white/70 uppercase font-medium">Inventory Units</div>
              <div class="text-[14px] sm:text-[15px] font-bold text-white tabular-nums">
                {analytics?.total_inventory_units ?? 0} items
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. 4-Column Quick Actions Strip */}
      <div class="grid grid-cols-4 gap-2.5">
        {[
          { label: "POS Sale", icon: <IconRegister class="w-5 h-5 text-[#007AFF]" />, bg: "bg-[#007AFF]/12", act: () => { activeTab.value = "counter"; } },
          { label: "+ Product", icon: <IconPlus class="w-5 h-5 text-[#34C759]" />, bg: "bg-[#34C759]/12", act: () => { editingProduct.value = null; productSheetOpen.value = true; } },
          { label: "Purchase", icon: <IconTruckSupplier class="w-5 h-5 text-[#AF52DE]" />, bg: "bg-[#AF52DE]/12", act: () => { supplierSheetOpen.value = true; } },
          { label: "+ Expense", icon: <IconWallet class="w-5 h-5 text-[#FF9500]" />, bg: "bg-[#FF9500]/12", act: () => { drawerSheetOpen.value = true; } },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.act}
            class="kura-card p-3 flex flex-col items-center justify-center gap-1.5 kura-btn-press transition"
          >
            <div class={`w-10 h-10 rounded-xl ${btn.bg} flex items-center justify-center`}>
              {btn.icon}
            </div>
            <span class="text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* 3. 4-Card Bento Grid */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div class="kura-card p-3.5 flex flex-col justify-between">
          <div class="flex items-start justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Gross Profit</span>
            <div class="kura-icon-squircle bg-[#34C759]/12 text-[#34C759]">
              <IconTrendUp class="w-4 h-4" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-[19px] font-bold text-[#34C759] tabular-nums">
              {formatMoney(analytics?.gross_profit_minor ?? 0, sym)}
            </div>
            <div class="text-[11px] text-[#86868B] tabular-nums">
              Margin: {((analytics?.margin_bps ?? 0) / 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div class="kura-card p-3.5 flex flex-col justify-between">
          <div class="flex items-start justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Stock Value</span>
            <div class="kura-icon-squircle bg-[#007AFF]/12 text-[#007AFF]">
              <IconBox class="w-4 h-4" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-[19px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {formatMoney(costVal, sym)}
            </div>
            <div class="text-[11px] text-[#86868B] tabular-nums truncate">
              Retail: {formatMoney(retVal, sym)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { khataSheetOpen.value = true; }}
          class="kura-card p-3.5 text-left flex flex-col justify-between hover:border-[#FF9500]/40 transition kura-btn-press"
        >
          <div class="flex items-start justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Customer Dues</span>
            <div class="kura-icon-squircle bg-[#FF9500]/12 text-[#FF9500]">
              <IconUsersDue class="w-4 h-4" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-[19px] font-bold text-[#FF9500] tabular-nums">
              {formatMoney(custDue, sym)}
            </div>
            <div class="text-[11px] text-[#86868B]">Khata ledger ➔</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => { supplierSheetOpen.value = true; }}
          class="kura-card p-3.5 text-left flex flex-col justify-between hover:border-[#AF52DE]/40 transition kura-btn-press"
        >
          <div class="flex items-start justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Supplier Payables</span>
            <div class="kura-icon-squircle bg-[#AF52DE]/12 text-[#AF52DE]">
              <IconTruckSupplier class="w-4 h-4" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-[19px] font-bold text-[#AF52DE] tabular-nums">
              {formatMoney(suppDue, sym)}
            </div>
            <div class="text-[11px] text-[#86868B]">Vendor dues ➔</div>
          </div>
        </button>
      </div>

      {/* 4. Sales Trend (Last 7 Days) Card */}
      <HomeTrendChart trend={trend} maxTrendRev={maxTrendRev} sym={sym} />
    </div>
  );
}
