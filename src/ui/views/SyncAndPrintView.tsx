import { useState } from "preact/hooks";
import { isOwner, syncStatus } from "../../state/kuraStore";
import { PrinterHubCard } from "../components/PrinterHubCard";
import { QrPairingCard } from "../components/QrPairingCard";
import { VaultBackupCard } from "../components/VaultBackupCard";

export function SyncAndPrintView() {
  const status = syncStatus.value;
  const owner = isOwner.value;
  const [showPhrase, setShowPhrase] = useState(false);

  return (
    <div class="space-y-4 pb-10">
      <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-[16px] font-bold text-[#1D1D1F]">Kura Sync Chain</h3>
              <span class="rounded-full bg-[#007AFF]/12 px-2 py-0.5 text-[11px] font-bold text-[#007AFF] tabular-nums">
                {status?.node_id ?? "K1"}
              </span>
              <span
                class={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  owner
                    ? "bg-[#34C759]/12 text-[#1E8E3E]"
                    : "bg-[#FF9500]/14 text-[#B25E00]"
                }`}
              >
                {status?.role ?? "OWNER"}
              </span>
            </div>
            <p class="mt-0.5 text-[12px] text-[#86868B] tabular-nums">
              LAN {status?.lan_ip ?? "—"} · {status?.peer_count ?? 0} peer(s) ·{" "}
              {status?.pending_events ?? 0} pending
            </p>
          </div>
        </div>

        {owner && status && (
          <div class="rounded-[11px] bg-[#F5F5F7] p-3">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-semibold text-[#86868B]">
                12-Word Master Recovery Phrase
              </span>
              <button
                type="button"
                onClick={() => setShowPhrase((v) => !v)}
                class="text-[11px] font-semibold text-[#007AFF]"
              >
                {showPhrase ? "Hide" : "Reveal"}
              </button>
            </div>
            <div class="mt-1.5 font-mono text-[12px] text-[#1D1D1F] select-all">
              {showPhrase
                ? status.recovery_phrase
                : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}
            </div>
          </div>
        )}
      </div>

      <QrPairingCard />
      <VaultBackupCard />
      <PrinterHubCard />
    </div>
  );
}
