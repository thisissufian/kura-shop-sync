//! Product projection. Field edits use last-writer-wins on `updated_hlc` (S3);
//! cost has its own clock `cost_hlc` because STOCK_PURCHASED also writes it.
//! Stock is a commutative counter and never touches either clock.
use rusqlite::{params, Transaction};

use crate::ledger::{ProductUpsertPayload, StockAdjustPayload};
use crate::models::LedgerEvent;

const DEFAULT_WARRANTY: &str = "No Warranty (ওয়ারেন্টি নেই)";

/// Adds `delta` to stock, creating a placeholder row (empty clocks) if the
/// product's PRODUCT_UPSERT has not arrived yet (S2).
pub fn add_stock(tx: &Transaction, sku: &str, delta: i64) -> Result<(), String> {
    tx.execute(
        "INSERT INTO products (sku, name, barcode, category, brand, variant, warranty_label, sell_price_minor, cost_price_minor, stock_qty, low_stock_threshold, updated_hlc, cost_hlc)
         VALUES (?1, ?1, NULL, 'General', '', '', ?3, 0, 0, ?2, 5, '', '')
         ON CONFLICT(sku) DO UPDATE SET stock_qty = stock_qty + excluded.stock_qty",
        params![sku, delta, DEFAULT_WARRANTY],
    )
    .map_err(|e| format!("Adjust stock for {sku}: {e}"))?;
    Ok(())
}

/// Sets cost only if `hlc` is newer than the last cost write.
pub fn set_cost_lww(tx: &Transaction, sku: &str, cost_minor: i64, hlc: &str) -> Result<(), String> {
    tx.execute(
        "UPDATE products SET cost_price_minor = ?2, cost_hlc = ?3 WHERE sku = ?1 AND cost_hlc <= ?3",
        params![sku, cost_minor, hlc],
    )
    .map_err(|e| format!("Set cost for {sku}: {e}"))?;
    Ok(())
}

pub fn apply_product_event(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    match ev.event_type.as_str() {
        "PRODUCT_UPSERT" => {
            let p: ProductUpsertPayload =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("PRODUCT_UPSERT: {e}"))?;
            tx.execute(
                "INSERT INTO products (sku, name, barcode, category, brand, variant, warranty_label, sell_price_minor, cost_price_minor, stock_qty, low_stock_threshold, updated_hlc, cost_hlc)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?11, ?11)
                 ON CONFLICT(sku) DO UPDATE SET
                   name = excluded.name, barcode = excluded.barcode, category = excluded.category,
                   brand = excluded.brand, variant = excluded.variant, warranty_label = excluded.warranty_label,
                   sell_price_minor = excluded.sell_price_minor,
                   low_stock_threshold = excluded.low_stock_threshold, updated_hlc = excluded.updated_hlc
                 WHERE products.updated_hlc <= excluded.updated_hlc",
                params![p.sku, p.name, p.barcode, p.category, p.brand, p.variant, p.warranty_label, p.sell_price_minor, p.cost_price_minor, p.low_stock_threshold, ev.hlc],
            )
            .map_err(|e| format!("Project PRODUCT_UPSERT: {e}"))?;
            set_cost_lww(tx, &p.sku, p.cost_price_minor, &ev.hlc)?;
        }
        "STOCK_ADJUST" => {
            let s: StockAdjustPayload =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("STOCK_ADJUST: {e}"))?;
            add_stock(tx, &s.sku, s.delta)?;
        }
        _ => {}
    }
    Ok(())
}
