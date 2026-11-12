mod cmd_billing;
mod cmd_catalog;
mod cmd_sync_print;
mod commands;
mod crypto_chain;
mod hlc;
mod lan_peer;
mod lan_sync;
mod ledger;
mod ledger_init;
mod ledger_queries;
mod mnemonic;
mod models;
mod printer;

use std::sync::{Arc, Mutex};
use tauri::Manager;

use crate::commands::AppState;
use crate::lan_sync::{spawn_lan_sync, LanSyncState};
use crate::ledger_init::init_db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Resolve app_data_dir: {e}"))?;
            let db_path = app_data.join("kura.db");
            let receipts_dir = app
                .path()
                .download_dir()
                .unwrap_or_else(|_| app_data.clone())
                .join("KuraReceipts");

            let conn = init_db(&db_path)?;
            let db = Arc::new(Mutex::new(conn));
            let lan = LanSyncState::new();

            spawn_lan_sync(db.clone(), lan.clone());

            app.manage(AppState {
                db,
                lan,
                receipts_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_catalog::get_bootstrap_state,
            cmd_catalog::upsert_product,
            cmd_catalog::adjust_stock,
            cmd_billing::issue_bill,
            cmd_billing::void_bill,
            cmd_billing::get_recent_bills,
            cmd_sync_print::get_sync_status,
            cmd_sync_print::join_sync_chain,
            cmd_sync_print::trigger_peer_sync,
            cmd_sync_print::print_bill_thermal,
            cmd_sync_print::export_bill_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kura");
}
