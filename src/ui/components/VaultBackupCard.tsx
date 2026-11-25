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
import { Toggle } from "../primitives/Controls";
import { FieldRow, Section } from "../primitives/Group";

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
      showToast("Live relay turned off");
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

  const relayState = connected ? "Live" : enabled ? "Connecting…" : "Off";

  return (
    <div class="space-y-6">
      <Section header="Live relay" footer="Sends encrypted (AES-256-GCM) changes over the internet, so phones sync beyond the shop Wi-Fi.">
        <div class="kura-row">
          <div class="min-w-0 flex-1">
            <div class="text-body text-label">Sync over the internet</div>
            <div class={`text-footnote flex items-center gap-1.5 ${connected ? "text-positive" : "text-label-2"}`}>
              {connected && <span class="kura-dot" />}
              {relayState}
            </div>
          </div>
          <Toggle on={enabled} onChange={() => void toggleRelay()} label="Sync over the internet" />
        </div>
        <FieldRow label="Relay">
          <input value={relayUrl} onInput={(e) => setRelayUrl((e.target as HTMLInputElement).value)}
            placeholder="wss://relay.damus.io" class="kura-field text-subhead" />
        </FieldRow>
      </Section>

      {owner && (
        <Section header="Encrypted backup" footer="A .kura file is encrypted with your sync chain key. Restoring on a new phone also needs the recovery phrase.">
          <button type="button" disabled={busy} onClick={handleExport} class="kura-row text-body text-tint disabled:opacity-40">
            Export .kura backup
          </button>
          {exportRes && (
            <div class="kura-row">
              <div class="min-w-0 flex-1">
                <div class="text-body text-label tabular-nums">
                  Saved {exportRes.events_count} events · {(exportRes.size_bytes / 1024).toFixed(1)} KB
                </div>
                <div class="text-footnote text-label-2 break-all">{exportRes.file_path}</div>
              </div>
              <button type="button" class="kura-btn kura-btn-tinted kura-btn-sm"
                onClick={async () => { await navigator.clipboard.writeText(exportRes.payload_b64); showToast("Copied backup"); }}>
                Copy
              </button>
            </div>
          )}
          <form onSubmit={handleImport} class="kura-row !block space-y-2.5 !py-3">
            <textarea rows={2} value={restoreB64} onInput={(e) => setRestoreB64((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste a .kura backup to restore" class="kura-input w-full p-3 text-footnote font-mono" />
            <input value={restorePhrase} onInput={(e) => setRestorePhrase((e.target as HTMLInputElement).value)}
              placeholder="Recovery phrase (new phone only)" class="kura-input w-full h-10 px-3 text-subhead" />
            <button type="submit" disabled={busy || !restoreB64.trim()} class="kura-btn kura-btn-gray w-full">
              Restore from backup
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}
