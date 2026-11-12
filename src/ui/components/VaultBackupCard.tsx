import { useState } from "preact/hooks";
import { isOwner, showToast } from "../../state/kuraStore";
import {
  connectRemoteRelay,
  disconnectRemoteRelay,
} from "../../state/remoteRelay";
import {
  remoteRelayConnected,
  remoteRelayEnabled,
  remoteRelayUrl,
} from "../../state/uiSignals";
import {
  exportEncryptedVaultBackup,
  importEncryptedVaultBackup,
} from "../../state/vaultConfigActions";
import type { VaultExportResult } from "../../types/kura";

export function VaultBackupCard() {
  const owner = isOwner.value;
  const enabled = remoteRelayEnabled.value;
  const connected = remoteRelayConnected.value;

  const [relayUrl, setRelayUrl] = useState(remoteRelayUrl.value);
  const [exportRes, setExportRes] = useState<VaultExportResult | null>(null);
  const [restoreB64, setRestoreB64] = useState("");
  const [restorePhrase, setRestorePhrase] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleRelay = async () => {
    if (enabled) {
      disconnectRemoteRelay(true);
      showToast("Remote Live Relay disconnected");
    } else {
      await connectRemoteRelay(relayUrl);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    const res = await exportEncryptedVaultBackup();
    if (res) setExportRes(res);
    setBusy(false);
  };

  const handleImport = async (e: Event) => {
    e.preventDefault();
    if (!restoreB64.trim()) return;
    setBusy(true);
    const ok = await importEncryptedVaultBackup(restoreB64, restorePhrase);
    if (ok) {
      setRestoreB64("");
      setRestorePhrase("");
    }
    setBusy(false);
  };

  return (
    <div class="space-y-4">
      <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-[15px] font-semibold text-[#1D1D1F]">
                Remote Live Relay
              </h3>
              <span
                class={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  connected
                    ? "bg-[#34C759]/14 text-[#1E8E3E]"
                    : enabled
                      ? "bg-[#FF9500]/14 text-[#B25E00]"
                      : "bg-black/[0.06] text-[#86868B]"
                }`}
              >
                {connected ? "LIVE" : enabled ? "CONNECTING" : "OFF"}
              </span>
            </div>
            <p class="text-[12px] text-[#86868B]">
              AES-256-GCM encrypted WebSocket broadcast beyond shop Wi-Fi
            </p>
          </div>
          <button
            type="button"
            onClick={toggleRelay}
            class={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
              enabled
                ? "bg-[#FF3B30]/12 text-[#FF3B30]"
                : "bg-[#34C759] text-white"
            }`}
          >
            {enabled ? "Disable" : "Enable"}
          </button>
        </div>

        <input
          value={relayUrl}
          onInput={(e) => setRelayUrl((e.target as HTMLInputElement).value)}
          placeholder="wss://relay.damus.io"
          class="w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[12px]"
        />
      </div>

      {owner && (
        <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
          <div>
            <h3 class="text-[15px] font-semibold text-[#1D1D1F]">
              Encrypted .kura Vault Backup
            </h3>
            <p class="text-[12px] text-[#86868B]">
              Zero-plaintext snapshot encrypted with your Sync Chain key
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleExport}
            class="w-full rounded-[11px] bg-[#1D1D1F] py-2.5 text-[13px] font-semibold text-white active:scale-[0.99] disabled:opacity-50 transition"
          >
            Export .kura Snapshot
          </button>

          {exportRes && (
            <div class="rounded-[11px] bg-[#34C759]/10 border border-[#34C759]/25 p-3 text-[11px] space-y-1.5">
              <div class="font-semibold text-[#1E8E3E]">
                Saved {exportRes.events_count} events ({(exportRes.size_bytes / 1024).toFixed(1)} KB)
              </div>
              <div class="break-all text-[#86868B]">{exportRes.file_path}</div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(exportRes.payload_b64);
                  showToast("Copied .kura payload");
                }}
                class="rounded-lg bg-[#34C759] px-2.5 py-1 font-semibold text-white"
              >
                Copy Encrypted Payload
              </button>
            </div>
          )}

          <form onSubmit={handleImport} class="space-y-2 pt-1 border-t border-black/[0.06]">
            <textarea
              rows={2}
              value={restoreB64}
              onInput={(e) => setRestoreB64((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste .kura encrypted vault payload to restore…"
              class="w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[12px] font-mono"
            />
            <input
              value={restorePhrase}
              onInput={(e) => setRestorePhrase((e.target as HTMLInputElement).value)}
              placeholder="12-word recovery phrase (if restoring onto a new phone)"
              class="w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[12px]"
            />
            <button
              type="submit"
              disabled={busy}
              class="w-full rounded-[11px] border border-black/[0.08] bg-white py-2 text-[13px] font-semibold text-[#007AFF] active:scale-[0.99] disabled:opacity-50"
            >
              Restore from .kura Vault
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
