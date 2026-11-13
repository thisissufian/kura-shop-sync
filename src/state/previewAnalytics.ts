import type { DailySalesPoint, OwnerAnalytics } from "../types/kura";
import { mockBills, mockCustomers, mockExpenses, mockProducts, mockSuppliers } from "./previewFixtures";

export function calcMockAnalytics(period = "ALL"): OwnerAnalytics {
  let gross = 0;
  let cogs = 0;
  let voided = 0;
  const perNode = new Map<string, { bills_count: number; revenue_minor: number }>();

  for (const b of mockBills) {
    if (b.voided) {
      voided++;
      continue;
    }
    gross += b.total_minor;
    const cur = perNode.get(b.node_id) ?? { bills_count: 0, revenue_minor: 0 };
    cur.bills_count += 1;
    cur.revenue_minor += b.total_minor;
    perNode.set(b.node_id, cur);
    for (const it of b.items) {
      const p = mockProducts.find((x) => x.sku === it.sku);
      cogs += (p?.cost_price_minor ?? 0) * it.qty;
    }
  }

  const grossProfit = gross - cogs;
  const expenses = mockExpenses.reduce((a, e) => a + e.amount_minor, 0);
  const netOperatingProfit = grossProfit - expenses;

  let invCost = 0;
  let invRetail = 0;
  let totalUnits = 0;
  for (const p of mockProducts) {
    if (p.stock_qty > 0) {
      invCost += p.cost_price_minor * p.stock_qty;
      invRetail += p.sell_price_minor * p.stock_qty;
      totalUnits += p.stock_qty;
    }
  }

  const customerReceivables = mockCustomers.reduce((a, c) => a + c.balance_due_minor, 0);
  const supplierPayables = mockSuppliers.reduce((a, s) => a + s.payable_balance_minor, 0);

  const daily_trend: DailySalesPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    const dayRev = i === 0 ? gross : Math.round(1500 + (6 - i) * 800);
    const dayProfit = Math.round(dayRev * 0.42);
    daily_trend.push({
      date_label: label,
      revenue_minor: dayRev,
      profit_minor: dayProfit,
      bills_count: i === 0 ? mockBills.length - voided : Math.max(1, 4 - i),
    });
  }

  return {
    period: period.toUpperCase(),
    gross_revenue_minor: gross,
    estimated_cogs_minor: cogs,
    gross_profit_minor: grossProfit,
    operating_expenses_minor: expenses,
    net_operating_profit_minor: netOperatingProfit,
    margin_bps: gross > 0 ? Math.trunc((grossProfit * 10000) / gross) : 0,
    total_bills_count: mockBills.length - voided,
    voided_bills_count: voided,
    inventory_cost_value_minor: invCost,
    retail_market_value_minor: invRetail,
    total_inventory_units: totalUnits,
    customer_receivables_minor: customerReceivables,
    supplier_payables_minor: supplierPayables,
    terminal_breakdown: Array.from(perNode.entries()).map(([node_id, v]) => ({ node_id, ...v })),
    daily_trend,
  };
}
