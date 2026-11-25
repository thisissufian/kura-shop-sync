use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection};
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
    ChainConfig, LedgerEvent, OwnerAnalytics, ShopSettings, ShopSettingsInput, VaultExportResult,
};

fn default_utc_offset() -> i64 {
    360
}

fn to_shop_settings(cfg: ChainConfig) -> ShopSettings {
    ShopSettings {
        shop_name: cfg.shop_name, shop_subtitle: cfg.shop_subtitle, currency_symbol: cfg.currency_symbol,
        receipt_footer: cfg.receipt_footer, utc_offset_minutes: cfg.utc_offset_minutes,
        node_id: cfg.node_id, role: cfg.role,
    }
}

#[derive(Serialize, Deserialize)]
struct VaultSnapshot {
    version: u8,
    shop_name: String,
    shop_subtitle: String,
    currency_symbol: String,
    receipt_footer: String,
    #[serde(default = "default_utc_offset")]
    utc_offset_minutes: i64,
    events: Vec<LedgerEvent>,
}

#[tauri::command]
pub fn get_shop_settings(state: State<'_, AppState>) -> Result<ShopSettings, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    Ok(to_shop_settings(get_chain_config(&conn)?))
}

#[tauri::command]
pub fn update_shop_settings(
    input: ShopSettingsInput,
    state: State<'_, AppState>,
) -> Result<ShopSettings, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    save_shop_settings_conn(&mut conn, input)
}

pub fn save_shop_settings_conn(
    conn: &mut Connection,
    input: ShopSettingsInput,
) -> Result<ShopSettings, String> {
    let cfg = get_chain_config(conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can update shop profile".to_string());
    }
    let shop_name = input.shop_name.trim();
    if shop_name.is_empty() {
        return Err("Shop name cannot be empty".to_string());
    }
    let currency = if input.currency_symbol.trim().is_empty() { "$".to_string() } else { input.currency_symbol.trim().to_string() };
    let footer = if input.receipt_footer.trim().is_empty() { "Thank you for shopping!".to_string() } else { input.receipt_footer.trim().to_string() };

    let hlc = next_hlc(conn, &cfg.node_id)?;
    let payload = ShopSettingsPayload {
        shop_name: shop_name.to_string(),
        shop_subtitle: input.shop_subtitle.trim().to_string(),
        currency_symbol: currency,
        receipt_footer: footer,
        utc_offset_minutes: input.utc_offset_minutes.clamp(-720, 840),
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
    Ok(to_shop_settings(get_chain_config(conn)?))
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

pub fn build_encrypted_vault(conn: &Connection) -> Result<(String, usize), String> {
    let cfg = get_chain_config(conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can export encrypted vault snapshots".to_string());
    }
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let events = all_ledger_events(conn)?;
    let count = events.len();
    let snapshot = VaultSnapshot {
        version: 1, shop_name: cfg.shop_name, shop_subtitle: cfg.shop_subtitle,
        currency_symbol: cfg.currency_symbol, receipt_footer: cfg.receipt_footer,
        utc_offset_minutes: cfg.utc_offset_minutes, events,
    };
    let plaintext = serde_json::to_vec(&snapshot).map_err(|e| e.to_string())?;
    let encrypted = encrypt_bytes(&seed, &plaintext)?;
    Ok((STANDARD.encode(&encrypted), count))
}

#[tauri::command]
pub fn export_encrypted_vault(state: State<'_, AppState>) -> Result<VaultExportResult, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let (payload_b64, events_count) = build_encrypted_vault(&conn)?;

    std::fs::create_dir_all(&state.receipts_dir).map_err(|e| format!("Create vault dir: {e}"))?;
    let ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
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
    restore_encrypted_vault(&mut conn, &payload_b64, recovery_phrase.as_deref())
}

/// Decrypts and verifies a vault snapshot before atomically updating chain config and ledger state.
pub fn restore_encrypted_vault(
    conn: &mut Connection,
    payload_b64: &str,
    recovery_phrase: Option<&str>,
) -> Result<usize, String> {
    let cfg = get_chain_config(conn)?;
    let recovery_seed = recovery_phrase
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(phrase_to_seed)
        .transpose()?;
    let seed = match recovery_seed {
        Some(s) => s,
        None => decode_seed_b64(&cfg.seed_b64)?,
    };

    let raw = STANDARD.decode(payload_b64.trim()).map_err(|_| "Invalid .kura vault base64 payload".to_string())?;
    let plaintext = decrypt_bytes(&seed, &raw)?;
    let snapshot: VaultSnapshot = serde_json::from_slice(&plaintext).map_err(|e| format!("Corrupt vault snapshot: {e}"))?;

    let encoded_seed = recovery_seed.map(|s| encode_seed_b64(&s));
    let (next_seed, next_role, next_linked) = match encoded_seed.as_deref() {
        Some(s) => (s, "OWNER", 1i64),
        None => (cfg.seed_b64.as_str(), cfg.role.as_str(), i64::from(cfg.is_linked)),
    };

    let mut applied = 0usize;
    let mut max_hlc = String::new();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE chain_config SET seed_b64 = ?1, role = ?2, is_linked = ?3, shop_name = ?4, shop_subtitle = ?5, currency_symbol = ?6, receipt_footer = ?7, utc_offset_minutes = ?8 WHERE id = 1",
        params![next_seed, next_role, next_linked, snapshot.shop_name, snapshot.shop_subtitle, snapshot.currency_symbol, snapshot.receipt_footer, snapshot.utc_offset_minutes],
    )
    .map_err(|e| format!("Restore shop profile: {e}"))?;

    for ev in snapshot.events {
        if ev.hlc > max_hlc {
            max_hlc = ev.hlc.clone();
        }
        if apply_ledger_event(&tx, &ev)? {
            applied += 1;
        }
    }
    if !max_hlc.is_empty() {
        let _ = observe_remote_hlc(&tx, &max_hlc, &cfg.node_id);
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(applied)
}
