use rusqlite::{params, Connection};
use std::path::Path;

use crate::crypto_chain::{encode_seed_b64, generate_seed};
use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::models::LedgerEvent;

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
           is_linked INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS ledger_events (
           event_id TEXT PRIMARY KEY,
           hlc TEXT NOT NULL,
           node_id TEXT NOT NULL,
           event_type TEXT NOT NULL,
           payload_json TEXT NOT NULL,
           synced_lan INTEGER NOT NULL DEFAULT 0,
           synced_relay INTEGER NOT NULL DEFAULT 0
         );
         CREATE INDEX IF NOT EXISTS idx_ledger_hlc ON ledger_events(hlc);
         CREATE TABLE IF NOT EXISTS products (
           sku TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           barcode TEXT,
           category TEXT NOT NULL,
           sell_price_minor INTEGER NOT NULL,
           cost_price_minor INTEGER NOT NULL,
           stock_qty INTEGER NOT NULL DEFAULT 0,
           low_stock_threshold INTEGER NOT NULL DEFAULT 5,
           updated_hlc TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS bills (
           bill_no TEXT PRIMARY KEY,
           node_id TEXT NOT NULL,
           hlc TEXT NOT NULL,
           items_json TEXT NOT NULL,
           discount_minor INTEGER NOT NULL,
           total_minor INTEGER NOT NULL,
           payment_mode TEXT NOT NULL,
           voided INTEGER NOT NULL DEFAULT 0
         );",
    )
    .map_err(|e| format!("Schema init: {e}"))?;

    let _ = conn.execute(
        "ALTER TABLE chain_config ADD COLUMN shop_subtitle TEXT NOT NULL DEFAULT ''",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE chain_config ADD COLUMN receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping!'",
        [],
    );

    let cfg_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM chain_config", [], |r| r.get(0))
        .unwrap_or(0);
    if cfg_count == 0 {
        let seed_b64 = encode_seed_b64(&generate_seed());
        conn.execute(
            "INSERT INTO chain_config (id, node_id, shop_name, shop_subtitle, currency_symbol, receipt_footer, role, seed_b64, last_hlc, is_linked)
             VALUES (1, 'K1', 'Kura General Store', 'Local Retail · Offline POS', '$', 'Thank you for shopping!', 'OWNER', ?1, '', 0)",
            params![seed_b64],
        )
        .map_err(|e| format!("Seed chain_config: {e}"))?;
    }

    let prod_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |r| r.get(0))
        .unwrap_or(0);
    let ev_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM ledger_events", [], |r| r.get(0))
        .unwrap_or(0);
    if prod_count == 0 && ev_count == 0 {
        seed_starter_inventory(&mut conn)?;
    }
    Ok(conn)
}

fn seed_starter_inventory(conn: &mut Connection) -> Result<(), String> {
    let starters = [
        ("SKU-101", "Artisan Cold Brew 250ml", "890101001010", "Beverages", 350, 180, 24, 6),
        ("SKU-102", "Organic Whole Milk 1L", "890101001027", "Dairy", 295, 210, 18, 5),
        ("SKU-103", "Sourdough Country Loaf", "890101001034", "Bakery", 550, 290, 9, 4),
        ("SKU-104", "Sea Salt Kettle Chips", "890101001041", "Snacks", 225, 120, 4, 5),
        ("SKU-105", "Matcha Green Tea Tin", "890101001058", "Pantry", 1490, 890, 12, 3),
    ];
    for (sku, name, bc, cat, sell, cost, qty, thresh) in starters {
        let hlc1 = next_hlc(conn, "K1")?;
        let upsert = ProductUpsertPayload {
            sku: sku.to_string(),
            name: name.to_string(),
            barcode: Some(bc.to_string()),
            category: cat.to_string(),
            sell_price_minor: sell,
            cost_price_minor: cost,
            low_stock_threshold: thresh,
        };
        let ev1 = LedgerEvent {
            event_id: new_event_id(&hlc1),
            hlc: hlc1,
            node_id: "K1".to_string(),
            event_type: "PRODUCT_UPSERT".to_string(),
            payload_json: serde_json::to_string(&upsert).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
        };
        let hlc2 = next_hlc(conn, "K1")?;
        let adj = StockAdjustPayload {
            sku: sku.to_string(),
            delta: qty,
            reason: "Initial Stock".to_string(),
        };
        let ev2 = LedgerEvent {
            event_id: new_event_id(&hlc2),
            hlc: hlc2,
            node_id: "K1".to_string(),
            event_type: "STOCK_ADJUST".to_string(),
            payload_json: serde_json::to_string(&adj).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
        };
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        apply_ledger_event(&tx, &ev1)?;
        apply_ledger_event(&tx, &ev2)?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}
