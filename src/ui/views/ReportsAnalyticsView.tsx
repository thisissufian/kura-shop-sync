import { useEffect, useState } from "preact/hooks";
import { formatMoney } from "../../state/ipcBridge";
import { currencySymbol, isOwner } from "../../state/kuraStore";
import { khataSheetOpen, supplierSheetOpen } from "../../state/uiSignals";
import type { OwnerAnalytics } from "../../types/kura";
import { callBackend } from "../../state/ipcBridge";

const PERIODS = [
  { id: "TODAY", label: "Today" },
  { id: "7D", label: "7 Days" },
  { id: "30D", label: "30 Days" },
  { id: "YEARLY", label: "Yearly" },
  { id: "ALL", label: "All Time" },
];

export function ReportsAnalyticsView() {
  const sym = currencySymbol.value;
  const owner = isOwner.value;
  const [period, setPeriod] = useState("TODAY");
  const [data, setData] = useState<OwnerAnalytics | null>(null);

  const fetchReports = async (p: string) => {
    if (!owner) return;
    try {
      const res = await callBackend<OwnerAnalytics>("get_owner_analytics", { period: p });
      setData(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchReports(period);
  }, [owner, period]);

  if (!owner) {
    return (
      <div class="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1C1C1E] p-8 text-center text-[#86868B] text-[14px]">
        🔒 Profit & Loss and Valuation Reports are strictly locked to OWNER devices.
      </div>
    );
  }

  const d = data;
  const rev = d?.gross_revenue_minor ?? 0;
  const cogs = d?.estimated_cogs_minor ?? 0;
  const grossProfit = d?.gross_profit_minor ?? 0;
  const expenses = d?.operating_expenses_minor ?? 0;
  const netProfit = d?.net_operating_profit_minor ?? 0;

  return (
    <div class="space-y-4 pb-24">
      {/* 1. Time-Period Pill Bar */}
      <div class="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div class="inline-flex rounded-[14px] bg-black/[0.05] dark:bg-white/[0.08] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              class={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition ${
                period === p.id
                  ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span class="text-[11px] text-[#86868B] tabular-nums">
          {d?.total_bills_count ?? 0} bills {d?.voided_bills_count ? `(${d.voided_bills_count} voided)` : ""}
        </span>
      </div>

      {/* 2. Profit & Loss Statement (P&L) Card */}
      <div class="rounded-[22px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-5 shadow-xs space-y-3.5">
        <div class="flex items-center justify-between">
          <h3 class="text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Profit & Loss Statement
          </h3>
          <span class="rounded-full bg-[#34C759]/12 text-[#1E8E3E] dark:text-[#34C759] px-2.5 py-0.5 text-[11px] font-bold">
            {((d?.margin_bps ?? 0) / 100).toFixed(1)}% Margin
          </span>
        </div>

        <div class="space-y-2 text-[13px] pt-1">
          <div class="flex justify-between items-center">
            <span class="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">Total Net Sales Revenue</span>
            <span class="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {formatMoney(rev, sym)}
            </span>
          </div>
          <div class="flex justify-between items-center text-[#FF3B30]">
            <span>(-) Cost of Goods Sold (COGS)</span>
            <span class="tabular-nums">- {formatMoney(cogs, sym)}</span>
          </div>
          <div class="flex justify-between items-center font-semibold text-[#1E8E3E] dark:text-[#34C759] border-t border-black/[0.04] dark:border-white/[0.06] pt-1.5">
            <span>Gross Operating Profit</span>
            <span class="tabular-nums">{formatMoney(grossProfit, sym)}</span>
          </div>
          <div class="flex justify-between items-center text-[#FF9500]">
            <span>(-) Operating Expenses (Expenses & Bills)</span>
            <span class="tabular-nums">- {formatMoney(expenses, sym)}</span>
          </div>
          <div class="flex justify-between items-center text-[16px] font-extrabold text-[#34C759] border-t border-black/[0.08] dark:border-white/[0.1] pt-2">
            <span>Net Operating Profit</span>
            <span class="tabular-nums">{formatMoney(netProfit, sym)}</span>
          </div>
        </div>
      </div>

      {/* 3. 4-Card Balance Sheet & Inventory Valuation Grid */}
      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 shadow-xs">
          <span class="text-[11px] font-medium text-[#86868B]">Inventory Cost Value</span>
          <div class="text-[18px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5">
            {formatMoney(d?.inventory_cost_value_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-0.5 tabular-nums">
            {d?.total_inventory_units ?? 0} total units in stock
          </div>
        </div>

        <div class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 shadow-xs">
          <span class="text-[11px] font-medium text-[#86868B]">Retail Market Value</span>
          <div class="text-[18px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5">
            {formatMoney(d?.retail_market_value_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-0.5 truncate">
            Projected customer value
          </div>
        </div>

        <button
          type="button"
          onClick={() => { khataSheetOpen.value = true; }}
          class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 text-left shadow-xs hover:border-[#FF9500]/40 transition"
        >
          <span class="text-[11px] font-medium text-[#86868B]">Customer Receivables</span>
          <div class="text-[18px] font-bold text-[#FF9500] tabular-nums mt-0.5">
            {formatMoney(d?.customer_receivables_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-0.5">Customer dues ledger ➔</div>
        </button>

        <button
          type="button"
          onClick={() => { supplierSheetOpen.value = true; }}
          class="rounded-[18px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-3.5 text-left shadow-xs hover:border-[#FF3B30]/40 transition"
        >
          <span class="text-[11px] font-medium text-[#86868B]">Supplier Payables</span>
          <div class="text-[18px] font-bold text-[#FF3B30] tabular-nums mt-0.5">
            {formatMoney(d?.supplier_payables_minor ?? 0, sym)}
          </div>
          <div class="text-[11px] text-[#86868B] mt-0.5">Vendor dues ledger ➔</div>
        </button>
      </div>

      {/* 4. Terminal Breakdown Split */}
      {d?.terminal_breakdown && d.terminal_breakdown.length > 0 && (
        <div class="rounded-[20px] bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-xs space-y-2">
          <span class="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Sales Split by Terminal
          </span>
          <div class="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
            {d.terminal_breakdown.map((t) => (
              <div key={t.node_id} class="flex items-center justify-between py-2 text-[13px]">
                <span class="font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">Terminal {t.node_id}</span>
                <span class="tabular-nums font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {formatMoney(t.revenue_minor, sym)} ({t.bills_count} bills)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
