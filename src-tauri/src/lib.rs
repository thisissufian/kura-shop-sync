mod cmd_billing;
mod cmd_catalog;
mod cmd_catalog_csv;
mod cmd_config_vault;
mod cmd_customers;
mod cmd_expenses;
mod cmd_suppliers;
mod cmd_sync_print;
mod commands;
mod crypto_chain;
mod hlc;
mod lan_peer;
mod lan_sync;
mod ledger;
mod ledger_analytics;
mod ledger_customers;
mod ledger_expenses;
mod ledger_init;
mod ledger_queries;
mod ledger_suppliers;
mod mnemonic;
mod models;
mod models_analytics;
mod models_supplier;
mod printer;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_print_csv;
#[cfg(test)]
mod tests_p_and_l;

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
            cmd_billing::find_bill_by_no,
            cmd_sync_print::get_sync_status,
            cmd_sync_print::join_sync_chain,
            cmd_sync_print::trigger_peer_sync,
            cmd_sync_print::print_bill_thermal,
            cmd_sync_print::export_bill_pdf,
            cmd_sync_print::prepare_relay_envelope,
            cmd_sync_print::ingest_relay_envelope,
            cmd_config_vault::get_shop_settings,
            cmd_config_vault::update_shop_settings,
            cmd_config_vault::get_owner_analytics,
            cmd_config_vault::export_encrypted_vault,
            cmd_config_vault::import_encrypted_vault,
            cmd_customers::get_customers,
            cmd_customers::upsert_customer,
            cmd_customers::record_customer_payment,
            cmd_catalog_csv::export_barcode_labels_pdf,
            cmd_catalog_csv::export_catalog_csv,
            cmd_catalog_csv::import_catalog_csv,
            cmd_expenses::log_shop_expense,
            cmd_expenses::get_cash_drawer_summary,
            cmd_suppliers::get_suppliers,
            cmd_suppliers::record_stock_purchase,
            cmd_suppliers::record_supplier_payment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kura");
}
