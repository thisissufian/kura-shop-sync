import { useState } from "preact/hooks";
import { callBackend } from "../../state/ipcBridge";
import { isOwner, refreshBootstrap, showToast, syncStatus } from "../../state/kuraStore";

// Shown only on OWNER devices of a chain created before owner signing (S4).
// Securing moves the shop to a new chain key. Other phones must scan the new
// QR; they keep their data when they do (see src-tauri/src/chain_upgrade.rs).
export function SecureChainCard() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = syncStatus.value;
  if (!status || !isOwner.value || status.is_secured) return null;

  const secure = async () => {
    setBusy(true);
    try {
      await callBackend("secure_sync_chain");
      await refreshBootstrap();
      setConfirming(false);
      showToast("Chain secured. Write down the new 24-word phrase, then re-pair every phone.");
    } catch (err) {
      showToast(String(err), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="rounded-2xl border border-[#FF9500]/30 bg-[#FF9500]/10 p-4 space-y-2">
      <p class="text-[13px] font-semibold kura-text-main">Secure this Sync Chain</p>
      <p class="text-[11px] kura-text-muted">
        This chain was created before owner signing, so a cashier phone could make itself an owner. Securing it gives owner
        actions a key only owner phones hold.
      </p>
      {confirming ? (
        <div class="space-y-2">
          <p class="text-[11px] font-medium kura-text-main">
            Sync every phone first. Afterwards each phone must scan the new QR (it keeps its sales), and your recovery phrase
            becomes a new 24-word phrase. Continue?
          </p>
          <div class="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}
              class="rounded-lg kura-subtle px-3 py-1.5 text-[11px] font-semibold kura-text-muted active:scale-95">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={secure}
              class="rounded-lg bg-[#FF9500] px-3 py-1.5 text-[11px] font-semibold text-white active:scale-95 disabled:opacity-50">
              Secure Chain
            </button>
          </div>
        </div>
      ) : (
        <div class="flex justify-end">
          <button type="button" onClick={() => setConfirming(true)}
            class="rounded-lg bg-[#FF9500] px-3 py-1.5 text-[11px] font-semibold text-white active:scale-95">
            Secure…
          </button>
        </div>
      )}
    </div>
  );
}
