import { signal } from "@preact/signals";

const MUTE_KEY = "kura_audio_muted_v1";

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export const audioMuted = signal<boolean>(loadMuted());

export function toggleAudioMute(): void {
  const next = !audioMuted.value;
  audioMuted.value = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
}

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (audioMuted.value || typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startOffset: number,
  duration: number,
  peakGain: number
): void {
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.01);
}

export function playScanBeep(): void {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 1200, "triangle", 0, 0.06, 0.14);
}

export function playCheckoutChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  // C6 -> G6 warm major fifth (Apple Pay style)
  tone(ctx, 1046.5, "sine", 0, 0.09, 0.15);
  tone(ctx, 1567.98, "sine", 0.075, 0.14, 0.17);
}

export function playWarningTone(): void {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 280, "sawtooth", 0, 0.055, 0.08);
  tone(ctx, 240, "sawtooth", 0.07, 0.07, 0.08);
}
