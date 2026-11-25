//! Demo catalog seeded on a fresh, unlinked install (cleared again on chain join, T5).
use rusqlite::Connection;

use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::{ProductUpsertPayload, StockAdjustPayload};
use crate::models::LedgerEvent;
use crate::owner_sig::apply_local_event;

const STARTERS: &[(&str, &str, &str, &str, &str, &str, &str, i64, i64, i64, i64)] = &[
    ("SKU-101", "Artisan Cold Brew 250ml", "890101001010", "Beverages", "Kura Brew", "250ml Bottle", "No Warranty (ওয়ারেন্টি নেই)", 35000, 18000, 24, 6),
    ("SKU-102", "Organic Whole Milk 1L", "890101001027", "Dairy", "FarmFresh", "1 Liter Tetra", "No Warranty (ওয়ারেন্টি নেই)", 29500, 21000, 18, 5),
    ("SKU-103", "Sourdough Country Loaf", "890101001034", "Bakery", "Artisan Oven", "Rustic Round", "No Warranty (ওয়ারেন্টি নেই)", 55000, 29000, 9, 4),
    ("SKU-104", "Sea Salt Kettle Chips", "890101001041", "Snacks", "Kettle Co", "Classic Salty", "No Warranty (ওয়ারেন্টি নেই)", 12000, 6500, 14, 5),
    ("SKU-105", "HOCO Rapid Charger 65W", "890101001058", "Electronics", "HOCO", "White · GaN", "6 Months Warranty", 149000, 89000, 12, 3),
];

/// Each starter product emits 2 ledger events: `PRODUCT_UPSERT` + `STOCK_ADJUST`.
pub const STARTER_EVENT_COUNT: usize = STARTERS.len() * 2;

pub fn seed_starter_inventory(conn: &mut Connection) -> Result<(), String> {
    let node: String = conn
        .query_row("SELECT node_id FROM chain_config WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| format!("Read node_id: {e}"))?;
    for &(sku, name, bc, cat, brand, variant, warranty, sell, cost, qty, thresh) in STARTERS {
        let hlc1 = next_hlc(conn, &node)?;
        let upsert = ProductUpsertPayload {
            sku: sku.to_string(),
            name: name.to_string(),
            barcode: Some(bc.to_string()),
            category: cat.to_string(),
            brand: brand.to_string(),
            variant: variant.to_string(),
            warranty_label: warranty.to_string(),
            sell_price_minor: sell,
            cost_price_minor: cost,
            low_stock_threshold: thresh,
        };
        let ev1 = LedgerEvent {
            event_id: new_event_id(&hlc1),
            hlc: hlc1,
            node_id: node.clone(),
            event_type: "PRODUCT_UPSERT".to_string(),
            payload_json: serde_json::to_string(&upsert).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        };
        let hlc2 = next_hlc(conn, &node)?;
        let adj = StockAdjustPayload {
            sku: sku.to_string(),
            delta: qty,
            reason: "Initial Stock".to_string(),
        };
        let ev2 = LedgerEvent {
            event_id: new_event_id(&hlc2),
            hlc: hlc2,
            node_id: node.clone(),
            event_type: "STOCK_ADJUST".to_string(),
            payload_json: serde_json::to_string(&adj).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        };
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        apply_local_event(&tx, &ev1)?;
        apply_local_event(&tx, &ev2)?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}
