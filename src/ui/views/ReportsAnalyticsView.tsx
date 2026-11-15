import { useEffect, useState } from "preact/hooks";
import { callBackend, formatMoney } from "../../state/ipcBridge";
import { currencySymbol, isOwner } from "../../state/kuraStore";
import type { OwnerAnalytics } from "../../types/kura";
import { ReportsValuationGrid } from "../components/ReportsValuationGrid";
import { IconChart } from "../primitives/KuraIcons";

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
      <div class="kura-card p-8 text-center text-[#86868B] text-[14px]">
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
    <div class="space-y-4 pb-4">
      {/* 1. Header & Time Range Selector */}
      <div class="space-y-2">
        <div>
          <h2 class="text-[20px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            Business Reports &amp; Analytics
          </h2>
          <p class="text-[12px] text-[#86868B]">
            Real-time P&amp;L statement, stock valuation, and revenue metrics
          </p>
        </div>

        <div class="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1">
          <div class="inline-flex rounded-[14px] bg-black/[0.05] dark:bg-white/[0.08] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                class={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition kura-btn-press ${
                  period === p.id
                    ? "bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span class="text-[11px] text-[#86868B] tabular-nums shrink-0">
            {d?.total_bills_count ?? 0} bills {d?.voided_bills_count ? `(${d.voided_bills_count} voided)` : ""}
          </span>
        </div>
      </div>

      {/* 2. Structured Profit & Loss Statement (P&L) Ledger */}
      <div class="kura-card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="kura-icon-squircle bg-[#34C759]/12 text-[#34C759]">
              <IconChart class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-[16px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                Profit &amp; Loss Statement (P&amp;L)
              </h3>
              <p class="text-[11px] text-[#86868B]">Accrual &amp; cash hybrid accounting</p>
            </div>
          </div>
          <span class="rounded-full bg-[#34C759]/12 text-[#1E8E3E] dark:text-[#34C759] px-2.5 py-0.5 text-[11px] font-bold">
            {((d?.margin_bps ?? 0) / 100).toFixed(1)}% Margin
          </span>
        </div>

        <div class="space-y-2.5 text-[13px] pt-1">
          <div class="flex justify-between items-center py-1">
            <span class="text-[#1D1D1F] dark:text-[#F5F5F7] font-medium">Total Net Sales Revenue</span>
            <span class="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {formatMoney(rev, sym)}
            </span>
          </div>

          <div class="flex justify-between items-center text-[#FF3B30] border-t border-black/[0.04] dark:border-white/[0.06] pt-2">
            <span>(-) Cost of Goods Sold (COGS)</span>
            <span class="tabular-nums font-semibold">- {formatMoney(cogs, sym)}</span>
          </div>

          <div class="flex justify-between items-center font-bold text-[#1E8E3E] dark:text-[#34C759] border-t border-black/[0.04] dark:border-white/[0.06] pt-2">
            <span>Gross Operating Profit</span>
            <span class="tabular-nums">{formatMoney(grossProfit, sym)}</span>
          </div>

          <div class="flex justify-between items-center text-[#FF9500] border-t border-black/[0.04] dark:border-white/[0.06] pt-2">
            <span>(-) Operating Expenses (Rent, Salary, Bills)</span>
            <span class="tabular-nums font-semibold">- {formatMoney(expenses, sym)}</span>
          </div>

          <div class="flex justify-between items-center text-[17px] font-extrabold text-[#34C759] border-t-2 border-black/[0.1] dark:border-white/[0.14] pt-2.5">
            <span>Net Operating Profit Estimate</span>
            <span class="tabular-nums">{formatMoney(netProfit, sym)}</span>
          </div>
        </div>
      </div>

      {/* 3. 4-Card Balance Sheet Valuation Grid */}
      <ReportsValuationGrid d={d} sym={sym} />

      {/* 4. Terminal Breakdown Split */}
      {d?.terminal_breakdown && d.terminal_breakdown.length > 0 && (
        <div class="kura-card p-4 space-y-2">
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
