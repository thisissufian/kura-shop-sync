use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::crypto_chain::{build_pairing_uri, decode_seed_b64};
use crate::lan_sync::{detect_local_ip, LanSyncState};
use crate::ledger_queries::{count_pending_events, get_chain_config};
use crate::mnemonic::seed_to_phrase;
use crate::models::SyncChainStatus;

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub lan: LanSyncState,
    pub receipts_dir: PathBuf,
}

pub fn build_sync_status(conn: &Connection, lan: &LanSyncState) -> Result<SyncChainStatus, String> {
    let cfg = get_chain_config(conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let phrase = if cfg.role == "OWNER" {
        seed_to_phrase(&seed)
    } else {
        "Hidden (Cashier Role)".to_string()
    };
    let ip = detect_local_ip();
    let lan_addr = format!("{ip}:{}", lan.bound_port());
    let pending = count_pending_events(conn)?;
    let pairing_uri_owner = if cfg.role == "OWNER" {
        build_pairing_uri(&seed, &cfg.seed_b64, "OWNER", "K2", &cfg.shop_name, &lan_addr)
    } else {
        String::new()
    };
    let pairing_uri_cashier = build_pairing_uri(
        &seed,
        &cfg.seed_b64,
        "CASHIER",
        "K3",
        &cfg.shop_name,
        &lan_addr,
    );

    Ok(SyncChainStatus {
        is_linked: cfg.is_linked,
        node_id: cfg.node_id,
        role: cfg.role,
        shop_name: cfg.shop_name,
        shop_subtitle: cfg.shop_subtitle,
        currency_symbol: cfg.currency_symbol,
        receipt_footer: cfg.receipt_footer,
        peer_count: lan.active_peer_count(),
        pending_events: pending,
        lan_ip: lan_addr,
        pairing_uri_owner,
        pairing_uri_cashier,
        recovery_phrase: phrase,
    })
}
