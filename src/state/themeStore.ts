import { signal } from "@preact/signals";

export type ThemeMode = "SYSTEM" | "LIGHT" | "DARK";

const THEME_KEY = "kura_theme_mode";

function loadMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "LIGHT" || v === "DARK" || v === "SYSTEM") return v;
  } catch {
    // ignore storage errors
  }
  return "SYSTEM";
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "DARK") return true;
  if (mode === "LIGHT") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const themeMode = signal<ThemeMode>(loadMode());
export const isDarkTheme = signal<boolean>(resolveDark(themeMode.value));

export function applyTheme(mode: ThemeMode = themeMode.value): void {
  const dark = resolveDark(mode);
  isDarkTheme.value = dark;
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#F5F5F7");
}

export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore storage errors
  }
  applyTheme(mode);
}

export function cycleThemeMode(): void {
  const order: ThemeMode[] = ["SYSTEM", "LIGHT", "DARK"];
  const next = order[(order.indexOf(themeMode.value) + 1) % order.length];
  setThemeMode(next);
}

export function initThemeListener(): () => void {
  applyTheme(themeMode.value);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (themeMode.value === "SYSTEM") applyTheme("SYSTEM");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
