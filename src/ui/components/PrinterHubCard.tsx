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
    <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-[15px] font-semibold text-[#1D1D1F]">
            Wireless Thermal &amp; PDF Hub
          </h3>
          <p class="text-[12px] text-[#86868B]">
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
              class={`rounded-[11px] border px-3 py-2 text-[13px] font-semibold transition ${
                active
                  ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                  : "border-black/[0.08] bg-[#F5F5F7] text-[#86868B]"
              }`}
            >
              {w}mm ({w === 58 ? "32 cols" : "48 cols"})
            </button>
          );
        })}
      </div>

      <div class="grid grid-cols-[1fr_92px] gap-2">
        <label class="block">
          <span class="text-[11px] font-medium text-[#86868B]">Printer IP</span>
          <input
            value={ip}
            onInput={(e) => setIp((e.target as HTMLInputElement).value)}
            onBlur={() => saveCfg()}
            placeholder="192.168.1.100"
            class="mt-1 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[13px] tabular-nums"
          />
        </label>
        <label class="block">
          <span class="text-[11px] font-medium text-[#86868B]">Port</span>
          <input
            type="number"
            value={port}
            onInput={(e) => setPort((e.target as HTMLInputElement).value)}
            onBlur={() => saveCfg()}
            class="mt-1 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[13px] tabular-nums"
          />
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleTestPrint}
          class="rounded-[11px] bg-[#007AFF] py-2.5 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-50 transition"
        >
          Test Thermal Print
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleExportLatestPdf}
          class="rounded-[11px] border border-black/[0.08] bg-white py-2.5 text-[13px] font-semibold text-[#1D1D1F] active:scale-95 disabled:opacity-50 transition"
        >
          Export Latest PDF
        </button>
      </div>
    </div>
  );
}
