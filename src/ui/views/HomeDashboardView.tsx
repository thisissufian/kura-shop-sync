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
import { PageHeader, Row, Section } from "../primitives/Group";
import { IconPlus, IconRegister, IconTruckSupplier, IconWallet } from "../primitives/KuraIcons";

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

export function HomeDashboardView() {
  const sym = currencySymbol.value;
  const owner = isOwner.value;
  const prodList = products.value;
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);

  useEffect(() => {
    if (!owner) return;
    callBackend<OwnerAnalytics>("get_owner_analytics", { period: "TODAY" })
      .then(setAnalytics)
      .catch(() => undefined);
  }, [owner, prodList.length]);

  const a = analytics;
  const profit = a?.net_operating_profit_minor ?? 0;
  const trend = a?.daily_trend ?? [];
  const maxTrendRev = Math.max(1, ...trend.map((t) => t.revenue_minor));

  const actions = [
    { label: "Sell", icon: <IconRegister class="w-6 h-6" />, act: () => { activeTab.value = "counter"; } },
    { label: "Add product", icon: <IconPlus class="w-6 h-6" />, act: () => { editingProduct.value = null; productSheetOpen.value = true; } },
    { label: "Purchase", icon: <IconTruckSupplier class="w-6 h-6" />, act: () => { supplierSheetOpen.value = true; } },
    { label: "Expense", icon: <IconWallet class="w-6 h-6" />, act: () => { drawerSheetOpen.value = true; } },
  ];

  return (
    <div class="space-y-7 pb-4">
      <PageHeader title="Today" subtitle={todayLabel()}>
        <button type="button" onClick={() => { activeTab.value = "counter"; }} class="kura-btn kura-btn-filled kura-btn-sm">
          New sale
        </button>
      </PageHeader>

      <div class="grid gap-7 lg:grid-cols-2 lg:items-start">
        <div class="space-y-7">
          <div class="kura-group p-4 pb-0">
            <div class="text-subhead text-label-2">Sales</div>
            <div class="text-[40px] leading-[48px] font-bold tracking-tight tabular-nums text-label">
              {formatMoney(a?.gross_revenue_minor ?? 0, sym)}
            </div>
            <div class="text-footnote text-label-2 tabular-nums pb-4">
              {a ? `${a.total_bills_count} ${a.total_bills_count === 1 ? "bill" : "bills"}` : owner ? "Loading…" : "Owner figures are hidden on cashier phones"}
            </div>
            {owner && (
              <div class="grid grid-cols-3 -mx-4 kura-hairline-t">
                {[
                  { k: "Net profit", v: formatMoney(profit, sym), c: profit < 0 ? "text-danger" : "text-positive" },
                  { k: "Expenses", v: formatMoney(a?.operating_expenses_minor ?? 0, sym), c: "text-label" },
                  { k: "Units in stock", v: String(a?.total_inventory_units ?? 0), c: "text-label" },
                ].map((m, i) => (
                  <div key={m.k} class={`px-4 py-3 ${i > 0 ? "border-l-[0.5px] border-sep" : ""}`}>
                    <div class="text-caption text-label-2 truncate">{m.k}</div>
                    <div class={`text-subhead font-semibold tabular-nums truncate ${m.c}`}>{m.v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div class="grid grid-cols-4 gap-2.5">
            {actions.map((btn) => (
              <button key={btn.label} type="button" onClick={btn.act}
                class="kura-group kura-btn-press flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 text-tint">
                {btn.icon}
                <span class="text-caption font-medium text-label text-center leading-tight">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="space-y-7">
          {owner && (
            <Section header="Balances">
              <Row label="Gross profit" detail={`Margin ${((a?.margin_bps ?? 0) / 100).toFixed(1)}%`}
                value={formatMoney(a?.gross_profit_minor ?? 0, sym)} valueClass="text-positive font-semibold" />
              <Row label="Stock at cost" detail={`Retail value ${formatMoney(a?.retail_market_value_minor ?? 0, sym)}`}
                value={formatMoney(a?.inventory_cost_value_minor ?? 0, sym)} valueClass="text-label font-semibold" />
              <Row label="Customer dues" detail="Khata ledger" onClick={() => { khataSheetOpen.value = true; }}
                value={formatMoney(a?.customer_receivables_minor ?? 0, sym)} valueClass="text-warning font-semibold" />
              <Row label="Supplier payables" detail="Money you owe vendors" onClick={() => { supplierSheetOpen.value = true; }}
                value={formatMoney(a?.supplier_payables_minor ?? 0, sym)} valueClass="text-label font-semibold" />
            </Section>
          )}
          <HomeTrendChart trend={trend} maxTrendRev={maxTrendRev} sym={sym} />
        </div>
      </div>
    </div>
  );
}
