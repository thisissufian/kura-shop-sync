//! Tauri commands for Nostr relay sync (S5); logic lives in `relay_nostr.rs`.
use serde_json::Value;
use tauri::State;

use crate::commands::AppState;
use crate::relay_nostr::{ingest_nostr_event, mark_relay_published, now_ms, pending_relay_batch, RelayBatch};

#[tauri::command]
pub fn relay_pending(state: State<'_, AppState>) -> Result<RelayBatch, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    pending_relay_batch(&conn, now_ms())
}

#[tauri::command]
pub fn relay_mark_published(d: String, digest: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    mark_relay_published(&conn, &d, &digest)
}

#[tauri::command]
pub fn relay_ingest(event: Value, state: State<'_, AppState>) -> Result<usize, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    ingest_nostr_event(&mut conn, &event)
}
