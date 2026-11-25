import { useState } from "preact/hooks";
import {
  exportPdf,
  printerSettings,
  printThermal,
  recentBills,
  showToast,
  updatePrinterSettings,
} from "../../state/kuraStore";
import { FieldRow, Section } from "../primitives/Group";
import { SegmentedControl } from "../primitives/SegmentedControl";

export function PrinterHubCard() {
  const cfg = printerSettings.value;
  const [ip, setIp] = useState(cfg.ip);
  const [port, setPort] = useState(String(cfg.port));
  const [busy, setBusy] = useState(false);

  const saveCfg = (widthMm: 58 | 80 = cfg.widthMm) => {
    updatePrinterSettings({
      ip: ip.trim() || "192.168.1.100",
      port: parseInt(port || "9100", 10) || 9100,
      widthMm,
    });
  };

  const latestBill = recentBills.value[0];

  const handleTestPrint = async () => {
    saveCfg();
    if (!latestBill) {
      showToast("Make a sale first, then print it here", "err");
      return;
    }
    setBusy(true);
    await printThermal(latestBill.bill_no);
    setBusy(false);
  };

  const handleExportLatestPdf = async () => {
    if (!latestBill) {
      showToast("Make a sale first, then save it as PDF", "err");
      return;
    }
    setBusy(true);
    await exportPdf(latestBill.bill_no);
    setBusy(false);
  };

  return (
    <Section header="Receipt printer" footer="Network thermal printers over raw ESC/POS on TCP. PDFs work without a printer.">
      <div class="kura-row">
        <span class="text-body text-label flex-1">Paper width</span>
        <SegmentedControl
          class="!w-auto"
          options={[{ id: "58", label: "58 mm" }, { id: "80", label: "80 mm" }]}
          value={String(cfg.widthMm) as "58" | "80"}
          onChange={(w) => saveCfg(w === "58" ? 58 : 80)}
        />
      </div>
      <FieldRow label="Printer IP">
        <input value={ip} onInput={(e) => setIp((e.target as HTMLInputElement).value)} onBlur={() => saveCfg()}
          placeholder="192.168.1.100" class="kura-field tabular-nums" />
      </FieldRow>
      <FieldRow label="Port">
        <input type="number" value={port} onInput={(e) => setPort((e.target as HTMLInputElement).value)} onBlur={() => saveCfg()}
          class="kura-field tabular-nums" />
      </FieldRow>
      <button type="button" disabled={busy} onClick={handleTestPrint} class="kura-row text-body text-tint disabled:opacity-40">
        Print the latest bill
      </button>
      <button type="button" disabled={busy} onClick={handleExportLatestPdf} class="kura-row text-body text-tint disabled:opacity-40">
        Save the latest bill as PDF
      </button>
    </Section>
  );
}
