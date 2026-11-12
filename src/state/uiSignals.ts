import { signal } from "@preact/signals";

export type ScannerMode = "BARCODE_CART" | "BARCODE_PREFILL" | "QR_PAIRING" | null;

export const scannerMode = signal<ScannerMode>(null);
export const scannedBarcodePrefill = signal<string | null>(null);
export const shopSettingsSheetOpen = signal<boolean>(false);
export const khataSheetOpen = signal<boolean>(false);
export const drawerSheetOpen = signal<boolean>(false);
export const csvSheetOpen = signal<boolean>(false);
export const remoteRelayEnabled = signal<boolean>(false);
export const remoteRelayConnected = signal<boolean>(false);
export const remoteRelayUrl = signal<string>("wss://relay.damus.io");
