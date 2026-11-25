use rusqlite::{params, Connection};
use std::path::Path;

use crate::crypto_chain::{encode_seed_b64, generate_node_id, generate_seed};
use crate::ledger_starters::seed_starter_inventory;
pub use crate::ledger_starters::STARTER_EVENT_COUNT;
use crate::owner_sig::{encode_secret, generate_owner_secret, owner_pk_hex};
use crate::ledger_rebuild::migrate_projections;

pub fn init_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create DB dir: {e}"))?;
    }
    let mut conn = Connection::open(db_path).map_err(|e| format!("Open SQLite: {e}"))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS chain_config (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           node_id TEXT NOT NULL,
           shop_name TEXT NOT NULL,
           shop_subtitle TEXT NOT NULL DEFAULT '',
           currency_symbol TEXT NOT NULL,
           receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping!',
           role TEXT NOT NULL,
           seed_b64 TEXT NOT NULL,
           last_hlc TEXT NOT NULL,
           is_linked INTEGER NOT NULL DEFAULT 0,
           utc_offset_minutes INTEGER NOT NULL DEFAULT 360,
           settings_hlc TEXT NOT NULL DEFAULT '',
           owner_secret TEXT NOT NULL DEFAULT '',
           owner_pk TEXT NOT NULL DEFAULT ''
         );
         CREATE TABLE IF NOT EXISTS ledger_events (
           event_id TEXT PRIMARY KEY,
           hlc TEXT NOT NULL,
           node_id TEXT NOT NULL,
           event_type TEXT NOT NULL,
           payload_json TEXT NOT NULL,
           synced_lan INTEGER NOT NULL DEFAULT 0,
           synced_relay INTEGER NOT NULL DEFAULT 0,
           sig TEXT NOT NULL DEFAULT ''
         );
         CREATE TABLE IF NOT EXISTS relay_published (
           d TEXT PRIMARY KEY,
           digest TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS rejected_events (
           event_id TEXT PRIMARY KEY,
           hlc TEXT NOT NULL,
           node_id TEXT NOT NULL,
           event_type TEXT NOT NULL,
           payload_json TEXT NOT NULL,
           sig TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX IF NOT EXISTS idx_ledger_hlc ON ledger_events(hlc);
         CREATE INDEX IF NOT EXISTS idx_ledger_node_hlc ON ledger_events(node_id, hlc);
         CREATE TABLE IF NOT EXISTS products (
           sku TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           barcode TEXT,
           category TEXT NOT NULL,
           brand TEXT NOT NULL DEFAULT '',
           variant TEXT NOT NULL DEFAULT '',
           warranty_label TEXT NOT NULL DEFAULT 'No Warranty (ওয়ারেন্টি নেই)',
           sell_price_minor INTEGER NOT NULL,
           cost_price_minor INTEGER NOT NULL,
           stock_qty INTEGER NOT NULL DEFAULT 0,
           low_stock_threshold INTEGER NOT NULL DEFAULT 5,
           updated_hlc TEXT NOT NULL,
           cost_hlc TEXT NOT NULL DEFAULT ''
         );
         CREATE TABLE IF NOT EXISTS bill_voids (
           bill_no TEXT PRIMARY KEY,
           hlc TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS bills (
           bill_no TEXT PRIMARY KEY,
           node_id TEXT NOT NULL,
           hlc TEXT NOT NULL,
           items_json TEXT NOT NULL,
           discount_minor INTEGER NOT NULL,
           total_minor INTEGER NOT NULL,
           payment_mode TEXT NOT NULL,
           customer_id TEXT,
           client_label TEXT NOT NULL DEFAULT 'Walk-in Customer',
           cashier_label TEXT NOT NULL DEFAULT 'Owner · K1',
           voided INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS customers (
           customer_id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           phone TEXT NOT NULL,
           balance_due_minor INTEGER NOT NULL DEFAULT 0,
           updated_hlc TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS suppliers (
           supplier_id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           phone TEXT NOT NULL,
           payable_balance_minor INTEGER NOT NULL DEFAULT 0,
           updated_hlc TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS expenses (
           expense_id TEXT PRIMARY KEY,
           category TEXT NOT NULL,
           amount_minor INTEGER NOT NULL,
           note TEXT NOT NULL,
           node_id TEXT NOT NULL,
           hlc TEXT NOT NULL
         );",
    )
    .map_err(|e| format!("Schema init: {e}"))?;

    let _ = conn.execute("ALTER TABLE bills ADD COLUMN customer_id TEXT", []);
    let _ = conn.execute("ALTER TABLE bills ADD COLUMN client_label TEXT NOT NULL DEFAULT 'Walk-in Customer'", []);
    let _ = conn.execute("ALTER TABLE bills ADD COLUMN cashier_label TEXT NOT NULL DEFAULT 'Owner · K1'", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN variant TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN warranty_label TEXT NOT NULL DEFAULT 'No Warranty (ওয়ারেন্টি নেই)'", []);
    let _ = conn.execute("ALTER TABLE chain_config ADD COLUMN shop_subtitle TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE chain_config ADD COLUMN receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping!'", []);
    let _ = conn.execute("ALTER TABLE chain_config ADD COLUMN utc_offset_minutes INTEGER NOT NULL DEFAULT 360", []);
    let _ = conn.execute("ALTER TABLE chain_config ADD COLUMN settings_hlc TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN cost_hlc TEXT NOT NULL DEFAULT ''", []);
    for col in ["chain_config ADD COLUMN owner_secret", "chain_config ADD COLUMN owner_pk", "ledger_events ADD COLUMN sig"] {
        let _ = conn.execute(&format!("ALTER TABLE {col} TEXT NOT NULL DEFAULT ''"), []);
    }

    let cfg_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM chain_config", [], |r| r.get(0))
        .unwrap_or(0);
    if cfg_count == 0 {
        let seed_b64 = encode_seed_b64(&generate_seed());
        // New chains are secured from birth (S4).
        let owner = generate_owner_secret();
        conn.execute(
            "INSERT INTO chain_config (id, node_id, shop_name, shop_subtitle, currency_symbol, receipt_footer, role, seed_b64, last_hlc, is_linked, owner_secret, owner_pk)
             VALUES (1, ?2, 'Kura General Store', 'Local Retail · Offline POS', '$', 'Thank you for shopping!', 'OWNER', ?1, '', 0, ?3, ?4)",
            params![seed_b64, generate_node_id(), encode_secret(&owner), owner_pk_hex(&owner)?],
        )
        .map_err(|e| format!("Seed chain_config: {e}"))?;
    }

    // Legacy invites handed every joiner K2/K3; move them to a unique ID (affects future events only).
    let _ = conn.execute("UPDATE chain_config SET node_id = ?1 WHERE id = 1 AND node_id IN ('K2', 'K3')", params![generate_node_id()]);

    let is_linked: i64 = conn
        .query_row("SELECT is_linked FROM chain_config WHERE id = 1", [], |r| r.get(0))
        .unwrap_or(0);
    let prod_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |r| r.get(0))
        .unwrap_or(0);
    let ev_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ledger_events", [], |r| r.get(0))
        .unwrap_or(0);
    migrate_projections(&mut conn);
    if is_linked == 0 && prod_count == 0 && ev_count == 0 {
        seed_starter_inventory(&mut conn)?;
    }
    Ok(conn)
}
