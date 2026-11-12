import { useEffect, useState } from "preact/hooks";
import QRCode from "qrcode";
import {
  isOwner,
  joinChain,
  showToast,
  syncStatus,
  syncWithPeer,
} from "../../state/kuraStore";
import { scannerMode } from "../../state/uiSignals";

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
      color: { dark: "#1D1D1F", light: "#FFFFFF" },
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
    if (!joinInput.trim()) return;
    setBusy(true);
    await joinChain(joinInput.trim());
    setJoinInput("");
    setBusy(false);
  };

  const handleSyncPeer = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    await syncWithPeer(peerIp);
    setBusy(false);
  };

  return (
    <div class="rounded-[14px] border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[15px] font-semibold text-[#1D1D1F]">Link Another Device</h3>
        <div class="inline-flex rounded-[10px] bg-black/[0.06] p-0.5">
          <button
            type="button"
            onClick={() => setQrMode("CASHIER")}
            class={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition ${
              qrMode === "CASHIER" ? "bg-white text-[#1D1D1F] shadow-xs" : "text-[#86868B]"
            }`}
          >
            Cashier QR
          </button>
          {owner && (
            <button
              type="button"
              onClick={() => setQrMode("OWNER")}
              class={`rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition ${
                qrMode === "OWNER" ? "bg-white text-[#1D1D1F] shadow-xs" : "text-[#86868B]"
              }`}
            >
              Owner QR
            </button>
          )}
        </div>
      </div>

      <div class="flex flex-col items-center rounded-[12px] bg-[#F5F5F7] p-4">
        {qrSvg ? (
          <div
            class="h-44 w-44 rounded-[10px] bg-white p-2 shadow-xs [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : (
          <div class="h-44 w-44 flex items-center justify-center text-[12px] text-[#86868B]">
            Generating QR…
          </div>
        )}
        <p class="mt-2.5 text-center text-[11px] text-[#86868B]">
          {qrMode === "OWNER"
            ? "Owner Phone: Full inventory, cost prices & void access"
            : "Cashier Phone: POS checkout & thermal print only"}
        </p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => copyText(activeUri, `${qrMode} Pairing URI`)}
            class="rounded-full bg-white border border-black/[0.08] px-3 py-1 text-[11px] font-semibold text-[#007AFF] active:scale-95"
          >
            Copy Pairing URI
          </button>
          <button
            type="button"
            onClick={() => {
              scannerMode.value = "QR_PAIRING";
            }}
            class="rounded-full bg-[#007AFF] px-3 py-1 text-[11px] font-semibold text-white active:scale-95"
          >
            Scan QR
          </button>
        </div>
      </div>

      <form onSubmit={handleJoin} class="flex gap-2">
        <input
          value={joinInput}
          onInput={(e) => setJoinInput((e.target as HTMLInputElement).value)}
          placeholder="Paste kura://join?... or 12-word phrase"
          class="flex-1 rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[12px]"
        />
        <button
          type="submit"
          disabled={busy}
          class="rounded-[10px] bg-[#1D1D1F] px-3.5 py-2 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          Join
        </button>
      </form>

      <form onSubmit={handleSyncPeer} class="flex gap-2">
        <input
          value={peerIp}
          onInput={(e) => setPeerIp((e.target as HTMLInputElement).value)}
          placeholder="Peer LAN IP (optional, e.g. 192.168.1.42)"
          class="flex-1 rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[12px] tabular-nums"
        />
        <button
          type="submit"
          disabled={busy}
          class="rounded-[10px] bg-[#007AFF] px-3.5 py-2 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          Sync Now
        </button>
      </form>
    </div>
  );
}
