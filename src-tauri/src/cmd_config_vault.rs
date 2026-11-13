use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::commands::AppState;
use crate::crypto_chain::{decode_seed_b64, decrypt_bytes, encode_seed_b64, encrypt_bytes};
use crate::hlc::{format_iso_ms, new_event_id, next_hlc, observe_remote_hlc};
use crate::ledger::{apply_ledger_event, ShopSettingsPayload};
use crate::ledger_analytics::compute_owner_analytics;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::mnemonic::phrase_to_seed;
use crate::models::{
    LedgerEvent, OwnerAnalytics, ShopSettings, ShopSettingsInput, VaultExportResult,
};

#[derive(Serialize, Deserialize)]
struct VaultSnapshot {
    version: u8,
    shop_name: String,
    shop_subtitle: String,
    currency_symbol: String,
    receipt_footer: String,
    events: Vec<LedgerEvent>,
}

#[tauri::command]
pub fn get_shop_settings(state: State<'_, AppState>) -> Result<ShopSettings, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    Ok(ShopSettings {
        shop_name: cfg.shop_name,
        shop_subtitle: cfg.shop_subtitle,
        currency_symbol: cfg.currency_symbol,
        receipt_footer: cfg.receipt_footer,
        node_id: cfg.node_id,
        role: cfg.role,
    })
}

#[tauri::command]
pub fn update_shop_settings(
    input: ShopSettingsInput,
    state: State<'_, AppState>,
) -> Result<ShopSettings, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can update shop profile".to_string());
    }
    let shop_name = input.shop_name.trim();
    if shop_name.is_empty() {
        return Err("Shop name cannot be empty".to_string());
    }
    let currency = if input.currency_symbol.trim().is_empty() {
        "$".to_string()
    } else {
        input.currency_symbol.trim().to_string()
    };
    let footer = if input.receipt_footer.trim().is_empty() {
        "Thank you for shopping!".to_string()
    } else {
        input.receipt_footer.trim().to_string()
    };

    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let payload = ShopSettingsPayload {
        shop_name: shop_name.to_string(),
        shop_subtitle: input.shop_subtitle.trim().to_string(),
        currency_symbol: currency,
        receipt_footer: footer,
    };
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "SHOP_SETTINGS_UPDATED".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;

    let updated = get_chain_config(&conn)?;
    Ok(ShopSettings {
        shop_name: updated.shop_name,
        shop_subtitle: updated.shop_subtitle,
        currency_symbol: updated.currency_symbol,
        receipt_footer: updated.receipt_footer,
        node_id: updated.node_id,
        role: updated.role,
    })
}

#[tauri::command]
pub fn get_owner_analytics(
    period: Option<String>,
    state: State<'_, AppState>,
) -> Result<OwnerAnalytics, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Profit analytics are locked to OWNER devices".to_string());
    }
    compute_owner_analytics(&conn, period.as_deref().unwrap_or("ALL"))
}

#[tauri::command]
pub fn export_encrypted_vault(state: State<'_, AppState>) -> Result<VaultExportResult, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can export encrypted vault snapshots".to_string());
    }
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let events = all_ledger_events(&conn)?;
    let events_count = events.len();
    let snapshot = VaultSnapshot {
        version: 1,
        shop_name: cfg.shop_name,
        shop_subtitle: cfg.shop_subtitle,
        currency_symbol: cfg.currency_symbol,
        receipt_footer: cfg.receipt_footer,
        events,
    };
    let plaintext = serde_json::to_vec(&snapshot).map_err(|e| e.to_string())?;
    let encrypted = encrypt_bytes(&seed, &plaintext)?;
    let payload_b64 = STANDARD.encode(&encrypted);

    std::fs::create_dir_all(&state.receipts_dir).map_err(|e| format!("Create vault dir: {e}"))?;
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let iso = format_iso_ms(ms);
    let stamp = format!("{}{}{}", &iso[2..4], &iso[5..7], &iso[8..10]);
    let file_path = state.receipts_dir.join(format!("kura-vault-{stamp}.kura"));
    std::fs::write(&file_path, payload_b64.as_bytes()).map_err(|e| format!("Write .kura: {e}"))?;

    Ok(VaultExportResult {
        file_path: file_path.to_string_lossy().into_owned(),
        size_bytes: payload_b64.len(),
        payload_b64,
        events_count,
    })
}

#[tauri::command]
pub fn import_encrypted_vault(
    payload_b64: String,
    recovery_phrase: Option<String>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let seed = if let Some(phrase) = recovery_phrase.filter(|s| !s.trim().is_empty()) {
        let s = phrase_to_seed(&phrase)?;
        conn.execute(
            "UPDATE chain_config SET seed_b64 = ?1, role = 'OWNER', is_linked = 1 WHERE id = 1",
            params![encode_seed_b64(&s)],
        )
        .map_err(|e| format!("Update seed on restore: {e}"))?;
        s
    } else {
        decode_seed_b64(&cfg.seed_b64)?
    };

    let raw = STANDARD
        .decode(payload_b64.trim())
        .map_err(|_| "Invalid .kura vault base64 payload".to_string())?;
    let plaintext = decrypt_bytes(&seed, &raw)?;
    let snapshot: VaultSnapshot =
        serde_json::from_slice(&plaintext).map_err(|e| format!("Corrupt vault snapshot: {e}"))?;

    conn.execute(
        "UPDATE chain_config SET shop_name = ?1, shop_subtitle = ?2, currency_symbol = ?3, receipt_footer = ?4 WHERE id = 1",
        params![
            snapshot.shop_name,
            snapshot.shop_subtitle,
            snapshot.currency_symbol,
            snapshot.receipt_footer
        ],
    )
    .map_err(|e| format!("Restore shop profile: {e}"))?;

    let mut applied = 0usize;
    let mut max_hlc = String::new();
    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for ev in snapshot.events {
            if ev.hlc > max_hlc {
                max_hlc = ev.hlc.clone();
            }
            if apply_ledger_event(&tx, &ev)? {
                applied += 1;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
    }
    if !max_hlc.is_empty() {
        let _ = observe_remote_hlc(&conn, &max_hlc, &cfg.node_id);
    }
    Ok(applied)
}
