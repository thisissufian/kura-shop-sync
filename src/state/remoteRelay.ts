import { callBackend } from "./ipcBridge";
import { refreshBootstrap, showToast } from "./kuraStore";
import { remoteRelayConnected, remoteRelayEnabled, remoteRelayUrl } from "./uiSignals";

// Remote sync over a Nostr relay (S5). The backend builds signed NIP-01 events
// (kind 30078, one encrypted chunk of the ledger each) and verifies incoming ones;
// this file only moves them over the WebSocket. A chunk counts as published only
// after the relay answers ["OK", id, true], so failed sends are retried next time.

/** Signed NIP-01 event built by the backend (S5). */
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface RelayBatch {
  chain_tag: string;
  since: number;
  events: { d: string; digest: string; event: NostrEvent }[];
}

const RELAY_CFG_KEY = "kura_remote_relay_v1";
const REPUBLISH_MS = 60_000;
let socket: WebSocket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let subId = "";
const awaitingOk = new Map<string, { d: string; digest: string }>();

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

async function handleRelayMessage(raw: string): Promise<void> {
  const msg = JSON.parse(raw) as unknown[];
  if (!Array.isArray(msg)) return;
  if (msg[0] === "EVENT" && msg[1] === subId && msg[2]) {
    const applied = await callBackend<number>("relay_ingest", { event: msg[2] as NostrEvent });
    if (applied > 0) {
      await refreshBootstrap();
      showToast(`Remote Live synced ${applied} event(s)`);
    }
  } else if (msg[0] === "OK" && typeof msg[1] === "string") {
    const pending = awaitingOk.get(msg[1]);
    awaitingOk.delete(msg[1]);
    if (pending && msg[2] === true) {
      await callBackend<void>("relay_mark_published", pending);
    }
  }
}

export async function connectRemoteRelay(url: string): Promise<void> {
  disconnectRemoteRelay(false);
  const cleanUrl = url.trim() || "wss://relay.damus.io";
  remoteRelayUrl.value = cleanUrl;
  remoteRelayEnabled.value = true;
  persistRelayCfg(true, cleanUrl);

  let batch: RelayBatch;
  try {
    batch = await callBackend<RelayBatch>("relay_pending");
  } catch (err) {
    showToast(String(err), "err");
    return;
  }

  try {
    const ws = new WebSocket(cleanUrl);
    socket = ws;
    subId = `kura-${batch.chain_tag}`;
    ws.onopen = () => {
      remoteRelayConnected.value = true;
      ws.send(JSON.stringify(["REQ", subId, { kinds: [30078], "#t": [batch.chain_tag], since: batch.since }]));
      void publishRelayDelta();
      timer = setInterval(() => void publishRelayDelta(), REPUBLISH_MS);
    };
    ws.onmessage = (msg) => {
      void handleRelayMessage(String(msg.data)).catch(() => {
        // ignore unrelated or malformed relay traffic
      });
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
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  awaitingOk.clear();
  remoteRelayConnected.value = false;
  if (saveDisabled) {
    remoteRelayEnabled.value = false;
    persistRelayCfg(false, remoteRelayUrl.value);
  }
}

export async function publishRelayDelta(): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    const batch = await callBackend<RelayBatch>("relay_pending");
    for (const out of batch.events) {
      if ([...awaitingOk.values()].some((p) => p.d === out.d && p.digest === out.digest)) continue;
      awaitingOk.set(out.event.id, { d: out.d, digest: out.digest });
      socket.send(JSON.stringify(["EVENT", out.event]));
    }
  } catch {
    // ignore background publish errors
  }
}
