import { useState } from "preact/hooks";
import { callBackend } from "../../state/ipcBridge";
import { isOwner, refreshBootstrap, showToast, syncStatus } from "../../state/kuraStore";
import { IconLock } from "../primitives/KuraIcons";

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
    <section>
      <div class="kura-group p-4 space-y-3">
        <div class="flex gap-3">
          <span class="mt-0.5 w-8 h-8 rounded-[8px] bg-warning-fill/15 text-warning flex items-center justify-center shrink-0">
            <IconLock class="w-[18px] h-[18px]" />
          </span>
          <div class="min-w-0 space-y-1">
            <p class="text-headline font-semibold text-label">Secure this sync chain</p>
            <p class="text-subhead text-label-2">
              This chain was created before owner signing, so a cashier phone could make itself an owner. Securing it gives
              owner actions a key that only owner phones hold.
            </p>
          </div>
        </div>
        {confirming ? (
          <div class="space-y-3 pt-1">
            <p class="text-subhead text-label">
              Sync every phone first. Afterwards each phone must scan the new QR (it keeps its sales), and your recovery
              phrase becomes a new 24-word phrase.
            </p>
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} class="kura-btn kura-btn-gray">Cancel</button>
              <button type="button" disabled={busy} onClick={secure} class="kura-btn kura-btn-filled">
                {busy ? "Securing…" : "Secure chain"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} class="kura-btn kura-btn-tinted w-full">
            Secure chain…
          </button>
        )}
      </div>
    </section>
  );
}
