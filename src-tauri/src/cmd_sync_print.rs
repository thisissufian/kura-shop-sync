use rusqlite::params;
use tauri::State;

use crate::commands::{build_sync_status, AppState};
use crate::crypto_chain::{encode_seed_b64, parse_pairing_uri};
use crate::lan_peer::sync_with_peer_ip;
use crate::ledger_queries::{get_bill_by_no, get_chain_config};
use crate::mnemonic::phrase_to_seed;
use crate::models::{PdfExportResult, SyncChainStatus};
use crate::printer::escpos::{format_receipt_bytes, send_tcp_print};
use crate::printer::pdf_gen::generate_receipt_pdf;

#[tauri::command]
pub fn get_sync_status(state: State<'_, AppState>) -> Result<SyncChainStatus, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    build_sync_status(&conn, &state.lan)
}

#[tauri::command]
pub async fn join_sync_chain(
    input: String,
    role_override: Option<String>,
    state: State<'_, AppState>,
) -> Result<SyncChainStatus, String> {
    let trimmed = input.trim();
    let (seed_b64, role, node_id, shop_name, lan_addr) = if trimmed.starts_with("kura://join?") {
        let p = parse_pairing_uri(trimmed)?;
        (p.seed_b64, p.role, p.node_id, p.shop_name, p.lan_addr)
    } else {
        let seed = phrase_to_seed(trimmed)?;
        let role = role_override
            .unwrap_or_else(|| "OWNER".to_string())
            .to_uppercase();
        if role != "OWNER" && role != "CASHIER" {
            return Err("Role must be OWNER or CASHIER".to_string());
        }
        let node = if role == "CASHIER" { "K3" } else { "K2" };
        (
            encode_seed_b64(&seed),
            role,
            node.to_string(),
            "Kura Synced Shop".to_string(),
            None,
        )
    };

    {
        let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
        conn.execute(
            "UPDATE chain_config
             SET seed_b64 = ?1, role = ?2, node_id = ?3, shop_name = ?4, is_linked = 1
             WHERE id = 1",
            params![seed_b64, role, node_id, shop_name],
        )
        .map_err(|e| format!("Update chain_config: {e}"))?;
    }

    if let Some(addr) = lan_addr {
        let _ = sync_with_peer_ip(&state.db, &addr).await;
    }
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    build_sync_status(&conn, &state.lan)
}

#[tauri::command]
pub async fn trigger_peer_sync(
    peer_ip: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if let Some(ip) = peer_ip.filter(|s| !s.trim().is_empty()) {
        let count = sync_with_peer_ip(&state.db, &ip).await?;
        return Ok(format!("Synced {count} new events with {ip}"));
    }
    let peers = state.lan.active_peer_count();
    Ok(format!("LAN Beacon active ({peers} nearby peer(s) detected)"))
}

#[tauri::command]
pub async fn print_bill_thermal(
    ip: String,
    port: u16,
    width_mm: u16,
    bill_no: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (cfg, bill) = {
        let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
        (get_chain_config(&conn)?, get_bill_by_no(&conn, &bill_no)?)
    };
    let bytes = format_receipt_bytes(&cfg.shop_name, &cfg.currency_symbol, &bill, width_mm);
    let len = bytes.len();
    send_tcp_print(&ip, port, &bytes).await?;
    Ok(format!("Sent {len} ESC/POS bytes to {ip}:{port}"))
}

#[tauri::command]
pub fn export_bill_pdf(
    bill_no: String,
    state: State<'_, AppState>,
) -> Result<PdfExportResult, String> {
    let (cfg, bill) = {
        let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
        (get_chain_config(&conn)?, get_bill_by_no(&conn, &bill_no)?)
    };
    generate_receipt_pdf(&state.receipts_dir, &cfg.shop_name, &cfg.currency_symbol, &bill)
}
