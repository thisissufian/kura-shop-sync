import { useEffect, useState } from "preact/hooks";
import QRCode from "qrcode";
import {
  isOwner,
  joinChain,
  showToast,
  syncStatus,
  syncWithPeer,
} from "../../state/kuraStore";
import { pendingChainJoin, scannerMode } from "../../state/uiSignals";
import { Section } from "../primitives/Group";
import { SegmentedControl } from "../primitives/SegmentedControl";

export function QrPairingCard() {
  const status = syncStatus.value;
  const owner = isOwner.value;
  const [qrMode, setQrMode] = useState<"CASHIER" | "OWNER">("CASHIER");
  const [qrSvg, setQrSvg] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [peerIp, setPeerIp] = useState("");
  const [busy, setBusy] = useState(false);

  const activeUri =
    qrMode === "OWNER" && owner
      ? status?.pairing_uri_owner ?? ""
      : status?.pairing_uri_cashier ?? "";

  useEffect(() => {
    if (!activeUri) {
      setQrSvg("");
      return;
    }
    QRCode.toString(activeUri, {
      type: "svg",
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(setQrSvg)
      .catch(() => setQrSvg(""));
  }, [activeUri]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}`);
    } catch {
      showToast("Clipboard unavailable", "err");
    }
  };

  const handleJoin = async (e: Event) => {
    e.preventDefault();
    const trimmed = joinInput.trim();
    if (!trimmed) return;
    setBusy(true);
    const ok = await joinChain(trimmed);
    if (ok) setJoinInput("");
    setBusy(false);
  };

  const handleConfirmReset = async () => {
    const pending = pendingChainJoin.value;
    if (!pending) return;
    setBusy(true);
    const ok = await joinChain(pending, undefined, true);
    if (ok) setJoinInput("");
    setBusy(false);
  };

  const handleSyncPeer = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    await syncWithPeer(peerIp);
    setBusy(false);
  };

  return (
    <div class="space-y-6">
      <Section header="Link another phone"
        footer={qrMode === "OWNER" ? "Owner phones see costs and profit, and can void bills." : "Cashier phones can sell and print, nothing more."}>
        <div class="flex flex-col items-center gap-4 px-4 py-5">
          {owner && (
            <SegmentedControl
              class="max-w-xs"
              options={[{ id: "CASHIER" as const, label: "Cashier" }, { id: "OWNER" as const, label: "Owner" }]}
              value={qrMode}
              onChange={setQrMode}
            />
          )}
          {qrSvg ? (
            <div class="h-48 w-48 rounded-[14px] bg-white p-2.5 ring-[0.5px] ring-sep [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : (
            <div class="h-48 w-48 rounded-[14px] bg-fill flex items-center justify-center text-footnote text-label-2">Making QR…</div>
          )}
          <p class="text-footnote text-label-2 text-center">On the other phone, open Kura and scan this code.</p>
          <div class="flex gap-2.5">
            <button type="button" onClick={() => copyText(activeUri, "pairing link")} class="kura-btn kura-btn-gray kura-btn-sm">Copy link</button>
            <button type="button" onClick={() => { scannerMode.value = "QR_PAIRING"; }} class="kura-btn kura-btn-filled kura-btn-sm">Scan a QR</button>
          </div>
        </div>
      </Section>

      <Section header="Join or sync by hand" footer="Leave the address empty to sync with every phone on this Wi-Fi.">
        <form onSubmit={handleJoin} class="kura-row !py-2">
          <input value={joinInput} onInput={(e) => setJoinInput((e.target as HTMLInputElement).value)}
            placeholder="kura://join link or recovery phrase" class="kura-field kura-field-left text-subhead" />
          <button type="submit" disabled={busy || !joinInput.trim()} class="kura-btn kura-btn-tinted kura-btn-sm">Join</button>
        </form>
        {pendingChainJoin.value && (
          <div class="kura-row !block space-y-3 !py-3">
            <p class="text-subhead text-label">
              Joining erases every sale and all stock stored on this phone, then copies the new chain. This can't be undone.
            </p>
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => { pendingChainJoin.value = null; }} class="kura-btn kura-btn-gray">Cancel</button>
              <button type="button" disabled={busy} onClick={handleConfirmReset} class="kura-btn kura-btn-danger-filled">Erase and join</button>
            </div>
          </div>
        )}
        <form onSubmit={handleSyncPeer} class="kura-row !py-2">
          <input value={peerIp} onInput={(e) => setPeerIp((e.target as HTMLInputElement).value)}
            placeholder="Phone address, e.g. 192.168.1.42" class="kura-field kura-field-left text-subhead tabular-nums" />
          <button type="submit" disabled={busy} class="kura-btn kura-btn-tinted kura-btn-sm">Sync now</button>
        </form>
      </Section>
    </div>
  );
}
