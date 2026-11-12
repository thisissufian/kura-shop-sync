import { invoke } from "@tauri-apps/api/core";
import type { PrinterSettings } from "../types/kura";
import { previewInvoke } from "./previewBridge";

export const PRINTER_STORAGE_KEY = "kura_printer_settings_v1";

export const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function callBackend<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauriRuntime) {
    return invoke<T>(cmd, args);
  }
  return previewInvoke<T>(cmd, args);
}

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PrinterSettings;
  } catch {
    // ignore storage errors
  }
  return { ip: "192.168.1.100", port: 9100, widthMm: 58 };
}

export function formatMoney(minorUnits: number, symbol = "$"): string {
  const neg = minorUnits < 0;
  const abs = Math.abs(Math.trunc(minorUnits));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${neg ? "-" : ""}${symbol}${whole}.${String(frac).padStart(2, "0")}`;
}

export function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const [w = "0", f = ""] = cleaned.split(".");
  const whole = parseInt(w || "0", 10);
  const frac = parseInt(f.padEnd(2, "0").slice(0, 2), 10);
  return whole * 100 + frac;
}
