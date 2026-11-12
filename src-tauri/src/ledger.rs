use rusqlite::{params, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

use crate::ledger_customers::apply_customer_event;
use crate::ledger_expenses::apply_expense_event;
use crate::models::{BillItem, BillReceipt, LedgerEvent};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductUpsertPayload {
    pub sku: String,
    pub name: String,
    pub barcode: Option<String>,
    pub category: String,
    pub sell_price_minor: i64,
    pub cost_price_minor: i64,
    pub low_stock_threshold: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockAdjustPayload {
    pub sku: String,
    pub delta: i64,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillVoidPayload {
    pub bill_no: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShopSettingsPayload {
    pub shop_name: String,
    pub shop_subtitle: String,
    pub currency_symbol: String,
    pub receipt_footer: String,
}

/// Idempotently appends an event and applies its projection inside the same SQLite TX.
pub fn apply_ledger_event(tx: &Transaction, ev: &LedgerEvent) -> Result<bool, String> {
    tx.execute(
        "INSERT OR IGNORE INTO ledger_events
         (event_id, hlc, node_id, event_type, payload_json, synced_lan, synced_relay)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            ev.event_id,
            ev.hlc,
            ev.node_id,
            ev.event_type,
            ev.payload_json,
            ev.synced_lan,
            ev.synced_relay
        ],
    )
    .map_err(|e| format!("Insert ledger_event: {e}"))?;

    if tx.changes() == 0 {
        return Ok(false);
    }

    match ev.event_type.as_str() {
        "PRODUCT_UPSERT" => {
            let p: ProductUpsertPayload =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("PRODUCT_UPSERT: {e}"))?;
            tx.execute(
                "INSERT INTO products (sku, name, barcode, category, sell_price_minor, cost_price_minor, stock_qty, low_stock_threshold, updated_hlc)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)
                 ON CONFLICT(sku) DO UPDATE SET
                   name = excluded.name,
                   barcode = excluded.barcode,
                   category = excluded.category,
                   sell_price_minor = excluded.sell_price_minor,
                   cost_price_minor = excluded.cost_price_minor,
                   low_stock_threshold = excluded.low_stock_threshold,
                   updated_hlc = excluded.updated_hlc
                 WHERE products.updated_hlc <= excluded.updated_hlc",
                params![
                    p.sku, p.name, p.barcode, p.category,
                    p.sell_price_minor, p.cost_price_minor, p.low_stock_threshold, ev.hlc
                ],
            )
            .map_err(|e| format!("Project PRODUCT_UPSERT: {e}"))?;
        }
        "STOCK_ADJUST" => {
            let s: StockAdjustPayload =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("STOCK_ADJUST: {e}"))?;
            tx.execute(
                "UPDATE products SET stock_qty = stock_qty + ?1, updated_hlc = ?2 WHERE sku = ?3",
                params![s.delta, ev.hlc, s.sku],
            )
            .map_err(|e| format!("Project STOCK_ADJUST: {e}"))?;
        }
        "BILL_ISSUED" => {
            let b: BillReceipt =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("BILL_ISSUED: {e}"))?;
            let items_json = serde_json::to_string(&b.items).map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT OR IGNORE INTO bills (bill_no, node_id, hlc, items_json, discount_minor, total_minor, payment_mode, customer_id, voided)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
                params![b.bill_no, b.node_id, b.hlc, items_json, b.discount_minor, b.total_minor, b.payment_mode, b.customer_id],
            )
            .map_err(|e| format!("Project BILL_ISSUED: {e}"))?;
            if tx.changes() > 0 {
                for item in &b.items {
                    tx.execute(
                        "UPDATE products SET stock_qty = stock_qty - ?1, updated_hlc = ?2 WHERE sku = ?3",
                        params![item.qty, ev.hlc, item.sku],
                    )
                    .map_err(|e| format!("Deduct stock for bill: {e}"))?;
                }
                if b.payment_mode == "DUE" {
                    if let Some(ref cid) = b.customer_id {
                        tx.execute(
                            "UPDATE customers SET balance_due_minor = balance_due_minor + ?1, updated_hlc = ?2 WHERE customer_id = ?3",
                            params![b.total_minor, ev.hlc, cid],
                        )
                        .map_err(|e| format!("Increment customer due: {e}"))?;
                    }
                }
            }
        }
        "BILL_VOIDED" => {
            let v: BillVoidPayload =
                serde_json::from_str(&ev.payload_json).map_err(|e| format!("BILL_VOIDED: {e}"))?;
            let existing: Option<(String, i64, String, i64, Option<String>)> = tx
                .query_row(
                    "SELECT items_json, voided, payment_mode, total_minor, customer_id FROM bills WHERE bill_no = ?1",
                    params![v.bill_no],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
                )
                .optional()
                .map_err(|e| format!("Lookup void bill: {e}"))?;
            if let Some((items_json, 0, pay_mode, total_minor, customer_id)) = existing {
                tx.execute(
                    "UPDATE bills SET voided = 1 WHERE bill_no = ?1",
                    params![v.bill_no],
                )
                .map_err(|e| format!("Mark bill voided: {e}"))?;
                let items: Vec<BillItem> =
                    serde_json::from_str(&items_json).map_err(|e| e.to_string())?;
                for item in items {
                    tx.execute(
                        "UPDATE products SET stock_qty = stock_qty + ?1, updated_hlc = ?2 WHERE sku = ?3",
                        params![item.qty, ev.hlc, item.sku],
                    )
                    .map_err(|e| format!("Restore stock on void: {e}"))?;
                }
                if pay_mode == "DUE" {
                    if let Some(cid) = customer_id {
                        tx.execute(
                            "UPDATE customers SET balance_due_minor = balance_due_minor - ?1, updated_hlc = ?2 WHERE customer_id = ?3",
                            params![total_minor, ev.hlc, cid],
                        )
                        .map_err(|e| format!("Reverse customer due on void: {e}"))?;
                    }
                }
            }
        }
        "CUSTOMER_UPSERT" | "CUSTOMER_PAYMENT" => {
            apply_customer_event(tx, ev)?;
        }
        "EXPENSE_LOGGED" => {
            apply_expense_event(tx, ev)?;
        }
        "SHOP_SETTINGS_UPDATED" => {
            let s: ShopSettingsPayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("SHOP_SETTINGS_UPDATED: {e}"))?;
            tx.execute(
                "UPDATE chain_config
                 SET shop_name = ?1, shop_subtitle = ?2, currency_symbol = ?3, receipt_footer = ?4
                 WHERE id = 1",
                params![s.shop_name, s.shop_subtitle, s.currency_symbol, s.receipt_footer],
            )
            .map_err(|e| format!("Project SHOP_SETTINGS_UPDATED: {e}"))?;
        }
        _ => {}
    }

    Ok(true)
}
