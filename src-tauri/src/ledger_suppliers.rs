use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};

use crate::ledger_products::{add_stock, set_cost_lww};
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

/// Moves the payable balance without touching the profile clock (S3); creates a
/// placeholder supplier if the payment arrives before any purchase (S2).
fn add_supplier_payable(tx: &Transaction, supplier_id: &str, delta: i64) -> Result<(), String> {
    tx.execute(
        "INSERT INTO suppliers (supplier_id, name, phone, payable_balance_minor, updated_hlc)
         VALUES (?1, ?1, '', ?2, '')
         ON CONFLICT(supplier_id) DO UPDATE SET payable_balance_minor = payable_balance_minor + excluded.payable_balance_minor",
        params![supplier_id, delta],
    )
    .map_err(|e| format!("Update supplier payable {supplier_id}: {e}"))?;
    Ok(())
}

pub fn apply_supplier_event(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    match ev.event_type.as_str() {
        "STOCK_PURCHASED" => {
            let p: StockPurchasePayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("STOCK_PURCHASED payload error: {e}"))?;

            add_supplier_payable(tx, &p.supplier_id, p.due_minor)?;
            // Name/phone are last-writer-wins on updated_hlc; only purchases carry them.
            tx.execute(
                "UPDATE suppliers SET
                   name = CASE WHEN ?2 != '' THEN ?2 ELSE name END,
                   phone = CASE WHEN ?3 != '' THEN ?3 ELSE phone END,
                   updated_hlc = ?4
                 WHERE supplier_id = ?1 AND updated_hlc <= ?4",
                params![p.supplier_id, p.supplier_name, p.supplier_phone, ev.hlc],
            )
            .map_err(|e| format!("Update supplier profile: {e}"))?;
            tx.execute(
                "INSERT INTO products (sku, name, barcode, category, brand, variant, warranty_label, sell_price_minor, cost_price_minor, stock_qty, low_stock_threshold, updated_hlc, cost_hlc)
                 VALUES (?1, ?1, NULL, 'General', '', '', 'No Warranty (ওয়ারেন্টি নেই)', ?2, ?2, 0, 5, '', '')
                 ON CONFLICT(sku) DO NOTHING",
                params![p.sku, p.unit_cost_minor],
            )
            .map_err(|e| format!("Placeholder product on purchase: {e}"))?;
            add_stock(tx, &p.sku, p.qty)?;
            set_cost_lww(tx, &p.sku, p.unit_cost_minor, &ev.hlc)?;
        }
        "SUPPLIER_PAYMENT" => {
            let pay: SupplierPaymentPayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("SUPPLIER_PAYMENT payload error: {e}"))?;

            add_supplier_payable(tx, &pay.supplier_id, -pay.amount_minor)?;
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
