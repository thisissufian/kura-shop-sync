import { useState } from "preact/hooks";
import {
  exportPdf,
  printerSettings,
  printThermal,
  recentBills,
  showToast,
  updatePrinterSettings,
} from "../../state/kuraStore";

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
      showToast("Issue at least one bill in Counter to test print", "err");
      return;
    }
    setBusy(true);
    await printThermal(latestBill.bill_no);
    setBusy(false);
  };

  const handleExportLatestPdf = async () => {
    if (!latestBill) {
      showToast("Issue at least one bill in Counter to export PDF", "err");
      return;
    }
    setBusy(true);
    await exportPdf(latestBill.bill_no);
    setBusy(false);
  };

  return (
    <div class="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] kura-card p-4 shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-[15px] font-semibold kura-text-main">
            Wireless Thermal &amp; PDF Hub
          </h3>
          <p class="text-[12px] kura-text-muted">
            Raw ESC/POS over TCP port 9100 &amp; pure vector PDF
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        {([58, 80] as const).map((w) => {
          const active = cfg.widthMm === w;
          return (
            <button
              key={w}
              type="button"
              onClick={() => saveCfg(w)}
              class={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition ${
                active
                  ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                  : "border-black/[0.08] dark:border-white/[0.08] kura-subtle kura-text-muted"
              }`}
            >
              {w}mm ({w === 58 ? "32 cols" : "48 cols"})
            </button>
          );
        })}
      </div>

      <div class="grid grid-cols-[1fr_92px] gap-2">
        <label class="block">
          <span class="text-[11px] font-medium kura-text-muted">Printer IP</span>
          <input
            value={ip}
            onInput={(e) => setIp((e.target as HTMLInputElement).value)}
            onBlur={() => saveCfg()}
            placeholder="192.168.1.100"
            class="mt-1 w-full rounded-xl kura-input px-3 py-2 text-[13px] tabular-nums"
          />
        </label>
        <label class="block">
          <span class="text-[11px] font-medium kura-text-muted">Port</span>
          <input
            type="number"
            value={port}
            onInput={(e) => setPort((e.target as HTMLInputElement).value)}
            onBlur={() => saveCfg()}
            class="mt-1 w-full rounded-xl kura-input px-3 py-2 text-[13px] tabular-nums"
          />
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleTestPrint}
          class="rounded-xl bg-[#007AFF] py-2.5 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-50 transition"
        >
          Test Thermal Print
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleExportLatestPdf}
          class="rounded-xl border border-black/[0.08] dark:border-white/[0.08] kura-subtle py-2.5 text-[13px] font-semibold kura-text-main active:scale-95 disabled:opacity-50 transition"
        >
          Export Latest PDF
        </button>
      </div>
    </div>
  );
}
