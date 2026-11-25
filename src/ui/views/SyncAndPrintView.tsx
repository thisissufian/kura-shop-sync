import { useState } from "preact/hooks";
import { isOwner, syncStatus } from "../../state/kuraStore";
import { PrinterHubCard } from "../components/PrinterHubCard";
import { QrPairingCard } from "../components/QrPairingCard";
import { SecureChainCard } from "../components/SecureChainCard";
import { VaultBackupCard } from "../components/VaultBackupCard";
import { PageHeader, Row, Section } from "../primitives/Group";

export function SyncAndPrintView() {
  const status = syncStatus.value;
  const owner = isOwner.value;
  const [showPhrase, setShowPhrase] = useState(false);
  const peers = status?.peer_count ?? 0;

  return (
    <div class="space-y-6 pb-10">
      <PageHeader title="Sync & More" subtitle={`Terminal ${status?.node_id ?? "K1"} · ${owner ? "Owner" : "Cashier"}`} />

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div class="space-y-6">
          <SecureChainCard />
          <Section header="This phone" footer="Phones on the same Wi-Fi sync on their own. Changes are end-to-end encrypted.">
            <Row label="Sync status" value={
              <span class="inline-flex items-center gap-1.5">
                <span class={`kura-dot ${peers > 0 ? "text-positive-fill" : "text-label-3"}`} />
                {peers > 0 ? `${peers} linked` : "No phones nearby"}
              </span>
            } />
            <Row label="Pending changes" value={String(status?.pending_events ?? 0)} />
            <Row label="Wi-Fi address" value={status?.lan_ip ?? "—"} />
            {owner && status && (
              <>
                <Row
                  label="Recovery phrase"
                  detail={status.is_secured ? "24 words · owner key" : "12 words"}
                >
                  <button type="button" onClick={() => setShowPhrase((v) => !v)} class="kura-btn kura-btn-gray kura-btn-sm">
                    {showPhrase ? "Hide" : "Show"}
                  </button>
                </Row>
                {showPhrase && (
                  <div class="kura-row">
                    <p class="font-mono text-subhead leading-relaxed text-label select-all break-words">{status.recovery_phrase}</p>
                  </div>
                )}
              </>
            )}
          </Section>
          <QrPairingCard />
        </div>

        <div class="space-y-6">
          <VaultBackupCard />
          <PrinterHubCard />
        </div>
      </div>
    </div>
  );
}
