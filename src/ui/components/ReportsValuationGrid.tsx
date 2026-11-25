import { formatMoney } from "../../state/ipcBridge";
import { khataSheetOpen, supplierSheetOpen } from "../../state/uiSignals";
import type { OwnerAnalytics } from "../../types/kura";
import { Row, Section } from "../primitives/Group";

interface Props {
  d: OwnerAnalytics | null;
  sym: string;
}

/** Balance-sheet style list: stock value and money owed in both directions. */
export function ReportsValuationGrid({ d, sym }: Props) {
  const m = (minor: number) => formatMoney(minor, sym);
  return (
    <Section header="Balance sheet">
      <Row label="Stock at cost" detail={`${d?.total_inventory_units ?? 0} units`}
        value={m(d?.inventory_cost_value_minor ?? 0)} valueClass="text-label" />
      <Row label="Stock at retail" detail="If everything sells at list price"
        value={m(d?.retail_market_value_minor ?? 0)} valueClass="text-label" />
      <Row label="Customer dues" detail="Owed to you" onClick={() => { khataSheetOpen.value = true; }}
        value={m(d?.customer_receivables_minor ?? 0)} valueClass="text-warning" />
      <Row label="Supplier payables" detail="You owe" onClick={() => { supplierSheetOpen.value = true; }}
        value={m(d?.supplier_payables_minor ?? 0)} valueClass="text-label" />
    </Section>
  );
}
