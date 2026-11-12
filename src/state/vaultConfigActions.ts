import { signal } from "@preact/signals";
import type {
  OwnerAnalytics,
  ShopSettings,
  ShopSettingsInput,
  VaultExportResult,
} from "../types/kura";
import { callBackend } from "./ipcBridge";
import { isOwner, refreshBootstrap, showToast } from "./kuraStore";

export const ownerAnalytics = signal<OwnerAnalytics | null>(null);

export async function refreshOwnerAnalytics(): Promise<void> {
  if (!isOwner.value) {
    ownerAnalytics.value = null;
    return;
  }
  try {
    ownerAnalytics.value = await callBackend<OwnerAnalytics>("get_owner_analytics");
  } catch {
    ownerAnalytics.value = null;
  }
}

export async function saveShopSettings(input: ShopSettingsInput): Promise<boolean> {
  try {
    await callBackend<ShopSettings>("update_shop_settings", { input });
    await refreshBootstrap();
    showToast("Shop profile updated & synced");
    return true;
  } catch (err) {
    showToast(String(err), "err");
    return false;
  }
}

export async function exportEncryptedVaultBackup(): Promise<VaultExportResult | null> {
  try {
    const res = await callBackend<VaultExportResult>("export_encrypted_vault");
    showToast(`Encrypted vault saved (${res.events_count} events)`);
    return res;
  } catch (err) {
    showToast(String(err), "err");
    return null;
  }
}

export async function importEncryptedVaultBackup(
  payloadB64: string,
  recoveryPhrase?: string
): Promise<boolean> {
  try {
    const applied = await callBackend<number>("import_encrypted_vault", {
      payloadB64,
      recoveryPhrase: recoveryPhrase?.trim() ? recoveryPhrase.trim() : null,
    });
    await refreshBootstrap();
    await refreshOwnerAnalytics();
    showToast(`Restored ${applied} ledger event(s)`);
    return true;
  } catch (err) {
    showToast(String(err), "err");
    return false;
  }
}
