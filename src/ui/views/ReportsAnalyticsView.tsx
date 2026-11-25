import { useEffect, useState } from "preact/hooks";
import { callBackend, formatMoney } from "../../state/ipcBridge";
import { currencySymbol, isOwner } from "../../state/kuraStore";
import type { OwnerAnalytics } from "../../types/kura";
import { ReportsValuationGrid } from "../components/ReportsValuationGrid";
import { PageHeader, Row, Section } from "../primitives/Group";
import { IconLock } from "../primitives/KuraIcons";
import { SegmentedControl } from "../primitives/SegmentedControl";

const PERIODS = [
  { id: "TODAY", label: "Today" },
  { id: "7D", label: "7 days" },
  { id: "30D", label: "30 days" },
  { id: "YEARLY", label: "Year" },
  { id: "ALL", label: "All" },
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
      <div class="space-y-6">
        <PageHeader title="Reports" />
        <div class="kura-group flex flex-col items-center text-center gap-2 px-6 py-12">
          <IconLock class="w-8 h-8 text-label-3" />
          <div class="text-headline font-semibold text-label">Reports are for owners</div>
          <p class="text-subhead text-label-2 max-w-xs">
            Profit, costs and stock value only show on owner phones. Switch to Owner to see them.
          </p>
        </div>
      </div>
    );
  }

  const d = data;
  const m = (minor: number) => formatMoney(minor, sym);
  const netProfit = d?.net_operating_profit_minor ?? 0;
  const bills = d?.total_bills_count ?? 0;

  return (
    <div class="space-y-6 pb-4">
      <PageHeader
        title="Reports"
        subtitle={`${bills} ${bills === 1 ? "bill" : "bills"}${d?.voided_bills_count ? ` · ${d.voided_bills_count} voided` : ""}`}
      />
      <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} class="lg:max-w-md" />

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div class="space-y-6">
          <div class="kura-group px-4 py-4">
            <div class="text-subhead text-label-2">Net profit</div>
            <div class={`text-[40px] leading-[48px] font-bold tracking-tight tabular-nums ${netProfit < 0 ? "text-danger" : "text-label"}`}>
              {m(netProfit)}
            </div>
            <div class="text-footnote text-label-2 tabular-nums">
              {((d?.margin_bps ?? 0) / 100).toFixed(1)}% gross margin
            </div>
          </div>

          <Section header="Profit and loss">
            <Row label="Sales" value={m(d?.gross_revenue_minor ?? 0)} valueClass="text-label" />
            <Row label="Cost of goods sold" value={`−${m(d?.estimated_cogs_minor ?? 0)}`} />
            <Row label={<span class="font-semibold">Gross profit</span>} value={m(d?.gross_profit_minor ?? 0)} valueClass="text-label font-semibold" />
            <Row label="Operating expenses" detail="Rent, salary, bills, petty cash" value={`−${m(d?.operating_expenses_minor ?? 0)}`} />
            <Row label={<span class="font-semibold">Net profit</span>} value={m(netProfit)}
              valueClass={`font-semibold ${netProfit < 0 ? "text-danger" : "text-positive"}`} />
          </Section>
        </div>

        <div class="space-y-6">
          <ReportsValuationGrid d={d} sym={sym} />

          {d?.terminal_breakdown && d.terminal_breakdown.length > 0 && (
            <Section header="Sales by terminal">
              {d.terminal_breakdown.map((t) => (
                <Row key={t.node_id} label={`Terminal ${t.node_id}`}
                  detail={`${t.bills_count} ${t.bills_count === 1 ? "bill" : "bills"}`}
                  value={m(t.revenue_minor)} valueClass="text-label" />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
