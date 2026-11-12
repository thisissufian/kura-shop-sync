import type { RelayEnvelope } from "../types/kura";
import { callBackend } from "./ipcBridge";
import { refreshBootstrap, showToast } from "./kuraStore";
import { remoteRelayConnected, remoteRelayEnabled, remoteRelayUrl } from "./uiSignals";

const RELAY_CFG_KEY = "kura_remote_relay_v1";
let socket: WebSocket | null = null;
let lastSentHlc = "";
let activeChainHash = "";

function persistRelayCfg(enabled: boolean, url: string): void {
  try {
    localStorage.setItem(RELAY_CFG_KEY, JSON.stringify({ enabled, url }));
  } catch {
    // ignore storage errors
  }
}

export function initRelaySettings(): void {
  try {
    const raw = localStorage.getItem(RELAY_CFG_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { enabled?: boolean; url?: string };
    if (parsed.url) remoteRelayUrl.value = parsed.url;
    if (parsed.enabled) {
      remoteRelayEnabled.value = true;
      void connectRemoteRelay(remoteRelayUrl.value);
    }
  } catch {
    // ignore
  }
}

function extractRelayCipher(data: unknown): string {
  if (Array.isArray(data) && data[0] === "EVENT" && data[2]?.content) {
    const p = JSON.parse(String(data[2].content)) as { chain_id_hash?: string; cipher_b64?: string };
    return p.chain_id_hash === activeChainHash ? p.cipher_b64 ?? "" : "";
  }
  if (data && typeof data === "object" && (data as { type?: string }).type === "kura_relay") {
    const o = data as { chain_id_hash?: string; cipher_b64?: string };
    return o.chain_id_hash === activeChainHash ? o.cipher_b64 ?? "" : "";
  }
  return "";
}

export async function connectRemoteRelay(url: string): Promise<void> {
  disconnectRemoteRelay(false);
  const cleanUrl = url.trim() || "wss://relay.damus.io";
  remoteRelayUrl.value = cleanUrl;
  remoteRelayEnabled.value = true;
  persistRelayCfg(true, cleanUrl);

  try {
    const env = await callBackend<RelayEnvelope>("prepare_relay_envelope", { sinceHlc: "" });
    activeChainHash = env.chain_id_hash;
  } catch (err) {
    showToast(String(err), "err");
    return;
  }

  try {
    const ws = new WebSocket(cleanUrl);
    socket = ws;
    ws.onopen = () => {
      remoteRelayConnected.value = true;
      ws.send(JSON.stringify(["REQ", `kura-${activeChainHash}`, { kinds: [29850], "#t": [activeChainHash], limit: 25 }]));
      void publishRelayDelta();
    };
    ws.onmessage = async (msg) => {
      try {
        const cipherB64 = extractRelayCipher(JSON.parse(String(msg.data)));
        if (!cipherB64) return;
        const applied = await callBackend<number>("ingest_relay_envelope", { cipherB64 });
        if (applied > 0) {
          await refreshBootstrap();
          showToast(`Remote Live synced ${applied} event(s)`);
        }
      } catch {
        // ignore unrelated relay traffic
      }
    };
    ws.onclose = () => {
      if (socket === ws) {
        remoteRelayConnected.value = false;
        socket = null;
      }
    };
    ws.onerror = () => {
      remoteRelayConnected.value = false;
    };
  } catch (err) {
    remoteRelayConnected.value = false;
    showToast(`Relay error: ${String(err)}`, "err");
  }
}

export function disconnectRemoteRelay(saveDisabled = true): void {
  if (socket) {
    socket.close();
    socket = null;
  }
  remoteRelayConnected.value = false;
  if (saveDisabled) {
    remoteRelayEnabled.value = false;
    persistRelayCfg(false, remoteRelayUrl.value);
  }
}

export async function publishRelayDelta(): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    const env = await callBackend<RelayEnvelope>("prepare_relay_envelope", { sinceHlc: lastSentHlc });
    if (!env.cipher_b64) return;
    lastSentHlc = env.latest_hlc;
    socket.send(JSON.stringify({ type: "kura_relay", chain_id_hash: env.chain_id_hash, cipher_b64: env.cipher_b64 }));
  } catch {
    // ignore background publish errors
  }
}
