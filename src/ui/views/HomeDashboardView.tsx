import { useEffect, useState } from "preact/hooks";
import { formatMoney } from "../../state/ipcBridge";
import {
  activeTab,
  currencySymbol,
  editingProduct,
  isOwner,
  products,
  productSheetOpen,
} from "../../state/kuraStore";
import {
  drawerSheetOpen,
  khataSheetOpen,
  supplierSheetOpen,
} from "../../state/uiSignals";
import type { OwnerAnalytics } from "../../types/kura";
import { callBackend } from "../../state/ipcBridge";

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
    <div class="space-y-4 pb-24">
      {/* 1. Today's Turnover Hero Card */}
      <div class="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1C1C1E] via-[#0F172A] to-[#090D16] text-white p-5 shadow-lg border border-white/[0.08]">
        <div class="flex items-start justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
              Today's Net Turnover
            </span>
            <div class="text-[34px] font-black tracking-tight mt-0.5 tabular-nums leading-none">
              {formatMoney(rev, sym)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { activeTab.value = "counter"; }}
            class="rounded-full bg-gradient-to-r from-[#007AFF] to-[#34C759] px-4 py-2 text-[12px] font-bold text-white shadow-md active:scale-95 transition"
          >
            + New Sale
          </button>
        </div>

        {owner && (
          <div class="mt-4 pt-3.5 border-t border-white/[0.1] grid grid-cols-3 gap-2 text-left">
            <div>
              <div class="text-[10px] text-[#86868B] uppercase">Net Profit</div>
              <div class="text-[14px] font-bold text-[#34C759] tabular-nums">
                {formatMoney(profit, sym)}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[#86868B] uppercase">Expenses</div>
              <div class="text-[14px] font-bold text-[#FF9500] tabular-nums">
                {formatMoney(exp, sym)}
              </div>
            </div>
            <div>
              <div class="text-[10px] text-[#86868B] uppercase">Stock Units</div>
              <div class="text-[14px] font-bold text-white tabular-nums">
                {analytics?.total_inventory_units ?? 0}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. 4-Button Quick Actions Row */}
      <div class="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => { activeTab.value = "counter"; }}
          class="flex flex-col items-center justify-center py-2.5 rounded-[16px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs active:scale-95 transition"
        >
          <span class="text-[20px] mb-1">⚡</span>
          <span class="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">POS Sale</span>
        </button>
        <button
          type="button"
          onClick={() => { editingProduct.value = null; productSheetOpen.value = true; }}
          class="flex flex-col items-center justify-center py-2.5 rounded-[16px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs active:scale-95 transition"
        >
          <span class="text-[20px] mb-1">📦</span>
          <span class="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">+ Product</span>
        </button>
        <button
          type="button"
          onClick={() => { supplierSheetOpen.value = true; }}
          class="flex flex-col items-center justify-center py-2.5 rounded-[16px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs active:scale-95 transition"
        >
          <span class="text-[20px] mb-1">🚚</span>
          <span class="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">+ Purchase</span>
        </button>
        <button
          type="button"
          onClick={() => { drawerSheetOpen.value = true; }}
          class="flex flex-col items-center justify-center py-2.5 rounded-[16px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs active:scale-95 transition"
        >
          <span class="text-[20px] mb-1">💸</span>
          <span class="text-[11px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">+ Expense</span>
        </button>
      </div>

      {/* 3. 4-Card Non-Redundant Bento Grid */}
      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 shadow-xs">
          <span class="text-[11px] font-semibold text-[#86868B]">Gross Profit (Today)</span>
          <div class="text-[20px] font-bold text-[#34C759] tabular-nums mt-0.5">
            {formatMoney(analytics?.gross_profit_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-1 tabular-nums">
            Margin: {((analytics?.margin_bps ?? 0) / 100).toFixed(1)}%
          </div>
        </div>

        <div class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 shadow-xs">
          <span class="text-[11px] font-semibold text-[#86868B]">Inventory Cost Value</span>
          <div class="text-[20px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5">
            {formatMoney(costVal, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-1 tabular-nums truncate">
            Retail: {formatMoney(retVal, sym)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => { khataSheetOpen.value = true; }}
          class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 text-left shadow-xs hover:border-[#FF9500]/40 transition active:scale-98"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Customer Dues</span>
            <span class="text-[12px] text-[#FF9500]">Khata ➔</span>
          </div>
          <div class="text-[20px] font-bold text-[#FF9500] tabular-nums mt-0.5">
            {formatMoney(custDue, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-1">Tap to collect dues</div>
        </button>

        <button
          type="button"
          onClick={() => { supplierSheetOpen.value = true; }}
          class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 text-left shadow-xs hover:border-[#FF3B30]/40 transition active:scale-98"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-[#86868B]">Vendor Payables</span>
            <span class="text-[12px] text-[#FF3B30]">Vendors ➔</span>
          </div>
          <div class="text-[20px] font-bold text-[#FF3B30] tabular-nums mt-0.5">
            {formatMoney(suppDue, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-1">Tap to pay suppliers</div>
        </button>
      </div>

      {/* 4. Sales Trend (Last 7 Days) SVG Bar Chart */}
      {trend.length > 0 && (
        <div class="rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-xs space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              7-Day Performance Trend
            </span>
            <button
              type="button"
              onClick={() => { activeTab.value = "reports"; }}
              class="text-[11px] font-semibold text-[#007AFF]"
            >
              Full P&L ➔
            </button>
          </div>
          <div class="grid grid-cols-7 gap-2 items-end h-28 pt-2">
            {trend.map((pt) => {
              const hPct = Math.max(10, Math.round((pt.revenue_minor / maxTrendRev) * 100));
              return (
                <div key={pt.date_label} class="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    style={{ height: `${hPct}%` }}
                    class="w-full rounded-t-lg bg-gradient-to-t from-[#007AFF] to-[#34C759] transition-all duration-300"
                    title={`${pt.date_label}: ${formatMoney(pt.revenue_minor, sym)} (${pt.bills_count} bills)`}
                  />
                  <span class="text-[10px] text-[#86868B] font-mono">{pt.date_label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
