use rusqlite::{params, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};

use crate::ledger_customers::{add_customer_due, apply_customer_event};
use crate::ledger_expenses::apply_expense_event;
use crate::ledger_products::{add_stock, apply_product_event};
use crate::ledger_suppliers::apply_supplier_event;
use crate::models::{BillItem, BillReceipt, LedgerEvent};

fn def_warranty() -> String {
    "No Warranty (ওয়ারেন্টি নেই)".to_string()
}

fn def_utc_offset() -> i64 {
    360
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductUpsertPayload {
    pub sku: String,
    pub name: String,
    pub barcode: Option<String>,
    pub category: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub variant: String,
    #[serde(default = "def_warranty")]
    pub warranty_label: String,
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
    #[serde(default = "def_utc_offset")]
    pub utc_offset_minutes: i64,
}

pub fn apply_ledger_event(tx: &Transaction, ev: &LedgerEvent) -> Result<bool, String> {
    tx.execute(
        "INSERT OR IGNORE INTO ledger_events
         (event_id, hlc, node_id, event_type, payload_json, synced_lan, synced_relay)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![ev.event_id, ev.hlc, ev.node_id, ev.event_type, ev.payload_json, ev.synced_lan, ev.synced_relay],
    )
    .map_err(|e| format!("Insert ledger_event: {e}"))?;

    if tx.changes() == 0 {
        return Ok(false);
    }

    match ev.event_type.as_str() {
        "PRODUCT_UPSERT" | "STOCK_ADJUST" => apply_product_event(tx, ev)?,
        "BILL_ISSUED" => apply_bill_issued(tx, ev)?,
        "BILL_VOIDED" => apply_bill_voided(tx, ev)?,
        "CUSTOMER_UPSERT" | "CUSTOMER_PAYMENT" => apply_customer_event(tx, ev)?,
        "STOCK_PURCHASED" | "SUPPLIER_PAYMENT" => apply_supplier_event(tx, ev)?,
        "EXPENSE_LOGGED" => apply_expense_event(tx, ev)?,
        "SHOP_SETTINGS_UPDATED" => {
            let s: ShopSettingsPayload = serde_json::from_str(&ev.payload_json).map_err(|e| format!("SHOP_SETTINGS_UPDATED: {e}"))?;
            tx.execute(
                "UPDATE chain_config SET shop_name = ?1, shop_subtitle = ?2, currency_symbol = ?3, receipt_footer = ?4, utc_offset_minutes = ?5, settings_hlc = ?6
                 WHERE id = 1 AND settings_hlc <= ?6",
                params![s.shop_name, s.shop_subtitle, s.currency_symbol, s.receipt_footer, s.utc_offset_minutes, ev.hlc],
            ).map_err(|e| format!("Project SHOP_SETTINGS_UPDATED: {e}"))?;
        }
        _ => {}
    }
    Ok(true)
}

/// A void that arrived first (S2) is recorded in `bill_voids`; the bill then lands
/// already voided and its stock/due effects are skipped, which nets to the same state.
fn apply_bill_issued(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    let b: BillReceipt = serde_json::from_str(&ev.payload_json).map_err(|e| format!("BILL_ISSUED: {e}"))?;
    let pre_voided: bool = tx
        .query_row("SELECT EXISTS(SELECT 1 FROM bill_voids WHERE bill_no = ?1)", params![b.bill_no], |r| r.get(0))
        .map_err(|e| format!("Lookup bill_voids: {e}"))?;
    let items_json = serde_json::to_string(&b.items).map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO bills (bill_no, node_id, hlc, items_json, discount_minor, total_minor, payment_mode, customer_id, client_label, cashier_label, voided)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![b.bill_no, b.node_id, b.hlc, items_json, b.discount_minor, b.total_minor, b.payment_mode, b.customer_id, b.client_label, b.cashier_label, pre_voided as i64],
    ).map_err(|e| format!("Project BILL_ISSUED: {e}"))?;
    if tx.changes() == 0 || pre_voided {
        return Ok(());
    }
    for item in &b.items {
        add_stock(tx, &item.sku, -item.qty)?;
    }
    if b.payment_mode == "DUE" {
        if let Some(ref cid) = b.customer_id {
            add_customer_due(tx, cid, b.total_minor)?;
        }
    }
    Ok(())
}

fn apply_bill_voided(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    let v: BillVoidPayload = serde_json::from_str(&ev.payload_json).map_err(|e| format!("BILL_VOIDED: {e}"))?;
    tx.execute("INSERT OR IGNORE INTO bill_voids (bill_no, hlc) VALUES (?1, ?2)", params![v.bill_no, ev.hlc])
        .map_err(|e| format!("Record bill void: {e}"))?;
    let existing: Option<(String, i64, String, i64, Option<String>)> = tx.query_row(
        "SELECT items_json, voided, payment_mode, total_minor, customer_id FROM bills WHERE bill_no = ?1",
        params![v.bill_no],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    ).optional().map_err(|e| format!("Lookup void bill: {e}"))?;
    let Some((items_json, 0, pay_mode, total_minor, customer_id)) = existing else {
        return Ok(());
    };
    tx.execute("UPDATE bills SET voided = 1 WHERE bill_no = ?1", params![v.bill_no]).map_err(|e| format!("Mark bill voided: {e}"))?;
    let items: Vec<BillItem> = serde_json::from_str(&items_json).map_err(|e| e.to_string())?;
    for item in items {
        add_stock(tx, &item.sku, item.qty)?;
    }
    if pay_mode == "DUE" {
        if let Some(cid) = customer_id {
            add_customer_due(tx, &cid, -total_minor)?;
        }
    }
    Ok(())
}
