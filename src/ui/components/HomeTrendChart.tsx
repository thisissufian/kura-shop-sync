import { activeTab } from "../../state/kuraStore";
import { formatMoney } from "../../state/ipcBridge";
import type { DailySalesPoint } from "../../types/kura";
import { Section } from "../primitives/Group";

interface Props {
  trend: DailySalesPoint[];
  maxTrendRev: number;
  sym: string;
}

/** Last-7-days bars: neutral fill, the latest day in the tint. */
export function HomeTrendChart({ trend, maxTrendRev, sym }: Props) {
  if (trend.length === 0) return null;
  const last = trend[trend.length - 1];

  return (
    <Section
      header="Last 7 days"
      trailing={
        <button type="button" onClick={() => { activeTab.value = "reports"; }} class="text-footnote text-tint">
          Reports
        </button>
      }
    >
      <div class="p-4">
        <div class="text-footnote text-label-2">Today</div>
        <div class="text-title3 font-semibold tabular-nums text-label">{formatMoney(last.revenue_minor, sym)}</div>
        <div class="mt-4 grid grid-cols-7 gap-2 items-end h-28">
          {trend.map((pt, i) => {
            const isLast = i === trend.length - 1;
            const hPct = Math.max(6, Math.round((pt.revenue_minor / maxTrendRev) * 100));
            return (
              <div key={pt.date_label} class="flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  style={{ height: `${hPct}%` }}
                  class={`w-full max-w-9 rounded-[5px] ${isLast ? "bg-tint" : "kura-chart-idle"}`}
                  title={`${pt.date_label}: ${formatMoney(pt.revenue_minor, sym)} (${pt.bills_count} bills)`}
                />
                <span class={`text-caption2 tabular-nums ${isLast ? "text-label font-semibold" : "text-label-2"}`}>
                  {pt.date_label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
