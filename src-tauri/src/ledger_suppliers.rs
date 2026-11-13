use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};

use crate::models::{LedgerEvent, SupplierAccount};

#[derive(Debug, Serialize, Deserialize)]
pub struct StockPurchasePayload {
    pub purchase_id: String,
    pub supplier_id: String,
    pub supplier_name: String,
    #[serde(default)]
    pub supplier_phone: String,
    pub sku: String,
    pub qty: i64,
    pub unit_cost_minor: i64,
    pub paid_minor: i64,
    pub due_minor: i64,
    pub node_id: String,
    pub hlc: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupplierPaymentPayload {
    pub payment_id: String,
    pub supplier_id: String,
    pub amount_minor: i64,
    pub note: String,
    pub node_id: String,
    pub hlc: String,
}

pub fn apply_supplier_event(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    match ev.event_type.as_str() {
        "STOCK_PURCHASED" => {
            let p: StockPurchasePayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("STOCK_PURCHASED payload error: {e}"))?;

            // 1. Atomically upsert supplier and increment payable balance
            tx.execute(
                "INSERT INTO suppliers (supplier_id, name, phone, payable_balance_minor, updated_hlc)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(supplier_id) DO UPDATE SET
                   name = CASE WHEN excluded.name != '' THEN excluded.name ELSE suppliers.name END,
                   payable_balance_minor = suppliers.payable_balance_minor + excluded.payable_balance_minor,
                   updated_hlc = excluded.updated_hlc",
                params![p.supplier_id, p.supplier_name, p.supplier_phone, p.due_minor, ev.hlc],
            )
            .map_err(|e| format!("Upsert supplier purchase: {e}"))?;

            // 2. Increment product stock and update unit cost price
            tx.execute(
                "INSERT INTO products (sku, name, barcode, category, brand, variant, warranty_label, sell_price_minor, cost_price_minor, stock_qty, low_stock_threshold, updated_hlc)
                 VALUES (?1, ?1, NULL, 'General', '', '', 'No Warranty (ওয়ারেন্টি নেই)', ?2, ?2, ?3, 5, ?4)
                 ON CONFLICT(sku) DO UPDATE SET
                   stock_qty = stock_qty + excluded.stock_qty,
                   cost_price_minor = excluded.cost_price_minor,
                   updated_hlc = excluded.updated_hlc",
                params![p.sku, p.unit_cost_minor, p.qty, ev.hlc],
            )
            .map_err(|e| format!("Restock product on purchase: {e}"))?;
        }
        "SUPPLIER_PAYMENT" => {
            let pay: SupplierPaymentPayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("SUPPLIER_PAYMENT payload error: {e}"))?;

            tx.execute(
                "UPDATE suppliers
                 SET payable_balance_minor = payable_balance_minor - ?1,
                     updated_hlc = ?2
                 WHERE supplier_id = ?3",
                params![pay.amount_minor, ev.hlc, pay.supplier_id],
            )
            .map_err(|e| format!("Deduct supplier payable: {e}"))?;
        }
        _ => {}
    }
    Ok(())
}

pub fn list_suppliers(conn: &Connection) -> Result<Vec<SupplierAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT supplier_id, name, phone, payable_balance_minor, updated_hlc
             FROM suppliers
             ORDER BY name COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("Prepare suppliers: {e}"))?;

    let rows = stmt
        .query_map([], |r| {
            Ok(SupplierAccount {
                supplier_id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                payable_balance_minor: r.get(3)?,
                updated_hlc: r.get(4)?,
            })
        })
        .map_err(|e| format!("Query suppliers: {e}"))?;

    let mut out = Vec::new();
    for s in rows {
        out.push(s.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn get_supplier_by_id(conn: &Connection, id: &str) -> Result<SupplierAccount, String> {
    conn.query_row(
        "SELECT supplier_id, name, phone, payable_balance_minor, updated_hlc
         FROM suppliers WHERE supplier_id = ?1",
        params![id],
        |r| {
            Ok(SupplierAccount {
                supplier_id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                payable_balance_minor: r.get(3)?,
                updated_hlc: r.get(4)?,
            })
        },
    )
    .map_err(|e| format!("Supplier not found: {e}"))
}
