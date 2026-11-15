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
    <div class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] kura-card p-3.5 shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[12px] font-semibold uppercase tracking-wide kura-text-muted">
          Owner Profit Analytics
        </span>
        <span class="rounded-full bg-[#34C759]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#1E8E3E] tabular-nums">
          {marginPct}% Margin
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-xl kura-subtle p-2.5">
          <div class="text-[10px] font-medium kura-text-muted">Gross Revenue</div>
          <div class="mt-0.5 text-[15px] font-bold kura-text-main tabular-nums">
            {formatMoney(a.gross_revenue_minor, sym)}
          </div>
          <div class="text-[10px] kura-text-muted tabular-nums">
            {a.total_bills_count} bill(s)
          </div>
        </div>

        <div class="rounded-xl kura-subtle p-2.5">
          <div class="text-[10px] font-medium kura-text-muted">Est. COGS</div>
          <div class="mt-0.5 text-[15px] font-bold kura-text-main tabular-nums">
            {formatMoney(a.estimated_cogs_minor, sym)}
          </div>
          <div class="text-[10px] kura-text-muted tabular-nums">
            {a.voided_bills_count} voided
          </div>
        </div>

        <div class="rounded-xl bg-[#34C759]/10 p-2.5">
          <div class="text-[10px] font-medium text-[#1E8E3E]">Net Profit</div>
          <div class="mt-0.5 text-[15px] font-bold text-[#1E8E3E] tabular-nums">
            {formatMoney(a.net_operating_profit_minor, sym)}
          </div>
          <div class="text-[10px] text-[#1E8E3E]/80 tabular-nums">Owner Only</div>
        </div>
      </div>

      {a.terminal_breakdown.length > 0 && (
        <div class="flex flex-wrap gap-1.5 pt-0.5">
          {a.terminal_breakdown.map((t) => (
            <div
              key={t.node_id}
              class="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] kura-subtle px-2.5 py-1 text-[11px] tabular-nums"
            >
              <span class="font-bold text-[#007AFF]">{t.node_id}</span>
              <span class="kura-text-main font-semibold">
                {formatMoney(t.revenue_minor, sym)}
              </span>
              <span class="kura-text-muted">({t.bills_count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
