import { activeTab } from "../../state/kuraStore";
import { formatMoney } from "../../state/ipcBridge";
import type { DailySalesPoint } from "../../types/kura";

interface Props {
  trend: DailySalesPoint[];
  maxTrendRev: number;
  sym: string;
}

export function HomeTrendChart({ trend, maxTrendRev, sym }: Props) {
  if (trend.length === 0) return null;

  return (
    <div class="kura-card p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[13px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
          7-Day Performance Trend
        </span>
        <button
          type="button"
          onClick={() => { activeTab.value = "reports"; }}
          class="text-[11px] font-semibold text-[#007AFF] hover:underline"
        >
          Full P&L ➔
        </button>
      </div>
      <div class="grid grid-cols-7 gap-2 items-end h-28 pt-2">
        {trend.map((pt) => {
          const isPeak = pt.revenue_minor === maxTrendRev && maxTrendRev > 0;
          const hPct = Math.max(12, Math.round((pt.revenue_minor / maxTrendRev) * 100));
          return (
            <div key={pt.date_label} class="flex flex-col items-center gap-1.5 h-full justify-end group">
              <div
                style={{ height: `${hPct}%` }}
                class={`w-full rounded-t-lg transition-all duration-300 ${
                  isPeak
                    ? "bg-gradient-to-t from-[#007AFF] to-[#34C759] shadow-xs"
                    : "bg-black/[0.08] dark:bg-white/[0.12] group-hover:bg-[#007AFF]/60"
                }`}
                title={`${pt.date_label}: ${formatMoney(pt.revenue_minor, sym)} (${pt.bills_count} bills)`}
              />
              <span class={`text-[10px] font-mono tabular-nums ${isPeak ? "font-bold text-[#007AFF]" : "text-[#86868B]"}`}>
                {pt.date_label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
