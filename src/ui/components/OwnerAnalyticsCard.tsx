import { useEffect } from "preact/hooks";
import { currencySymbol, formatMoney, isOwner, recentBills } from "../../state/kuraStore";
import { ownerAnalytics, refreshOwnerAnalytics } from "../../state/vaultConfigActions";

export function OwnerAnalyticsCard() {
  const owner = isOwner.value;
  const billsLen = recentBills.value.length;

  useEffect(() => {
    if (owner) void refreshOwnerAnalytics();
  }, [owner, billsLen]);

  if (!owner || !ownerAnalytics.value) return null;
  const a = ownerAnalytics.value;
  const sym = currencySymbol.value;
  const marginPct = (a.margin_bps / 100).toFixed(2);

  return (
    <div class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[12px] font-semibold uppercase tracking-wide text-[#86868B]">
          Owner Profit Analytics
        </span>
        <span class="rounded-full bg-[#34C759]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#1E8E3E] tabular-nums">
          {marginPct}% Margin
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-[11px] bg-[#F5F5F7] p-2.5">
          <div class="text-[10px] font-medium text-[#86868B]">Gross Revenue</div>
          <div class="mt-0.5 text-[15px] font-bold text-[#1D1D1F] tabular-nums">
            {formatMoney(a.gross_revenue_minor, sym)}
          </div>
          <div class="text-[10px] text-[#AEAEB2] tabular-nums">
            {a.total_bills_count} bill(s)
          </div>
        </div>

        <div class="rounded-[11px] bg-[#F5F5F7] p-2.5">
          <div class="text-[10px] font-medium text-[#86868B]">Est. COGS</div>
          <div class="mt-0.5 text-[15px] font-bold text-[#1D1D1F] tabular-nums">
            {formatMoney(a.estimated_cogs_minor, sym)}
          </div>
          <div class="text-[10px] text-[#AEAEB2] tabular-nums">
            {a.voided_bills_count} voided
          </div>
        </div>

        <div class="rounded-[11px] bg-[#34C759]/10 p-2.5">
          <div class="text-[10px] font-medium text-[#1E8E3E]">Net Profit</div>
          <div class="mt-0.5 text-[15px] font-bold text-[#1E8E3E] tabular-nums">
            {formatMoney(a.net_profit_minor, sym)}
          </div>
          <div class="text-[10px] text-[#1E8E3E]/80 tabular-nums">Owner Only</div>
        </div>
      </div>

      {a.terminal_breakdown.length > 0 && (
        <div class="flex flex-wrap gap-1.5 pt-0.5">
          {a.terminal_breakdown.map((t) => (
            <div
              key={t.node_id}
              class="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-[#F5F5F7] px-2.5 py-1 text-[11px] tabular-nums"
            >
              <span class="font-bold text-[#007AFF]">{t.node_id}</span>
              <span class="text-[#1D1D1F] font-semibold">
                {formatMoney(t.revenue_minor, sym)}
              </span>
              <span class="text-[#86868B]">({t.bills_count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
