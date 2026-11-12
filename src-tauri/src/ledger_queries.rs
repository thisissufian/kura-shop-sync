use rusqlite::{params, Connection};

use crate::models::{BillItem, BillReceipt, ChainConfig, LedgerEvent, Product};

pub fn get_chain_config(conn: &Connection) -> Result<ChainConfig, String> {
    conn.query_row(
        "SELECT node_id, shop_name, shop_subtitle, currency_symbol, receipt_footer, role, seed_b64, last_hlc, is_linked
         FROM chain_config WHERE id = 1",
        [],
        |r| {
            let linked_int: i64 = r.get(8)?;
            Ok(ChainConfig {
                node_id: r.get(0)?,
                shop_name: r.get(1)?,
                shop_subtitle: r.get(2)?,
                currency_symbol: r.get(3)?,
                receipt_footer: r.get(4)?,
                role: r.get(5)?,
                seed_b64: r.get(6)?,
                last_hlc: r.get(7)?,
                is_linked: linked_int != 0,
            })
        },
    )
    .map_err(|e| format!("Read chain_config: {e}"))
}

pub fn list_products(conn: &Connection, redact_cost: bool) -> Result<Vec<Product>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sku, name, barcode, category, sell_price_minor, cost_price_minor,
                    stock_qty, low_stock_threshold, updated_hlc
             FROM products
             ORDER BY category ASC, name ASC",
        )
        .map_err(|e| format!("Prepare products: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            let cost: i64 = r.get(5)?;
            Ok(Product {
                sku: r.get(0)?,
                name: r.get(1)?,
                barcode: r.get(2)?,
                category: r.get(3)?,
                sell_price_minor: r.get(4)?,
                cost_price_minor: if redact_cost { 0 } else { cost },
                stock_qty: r.get(6)?,
                low_stock_threshold: r.get(7)?,
                updated_hlc: r.get(8)?,
            })
        })
        .map_err(|e| format!("Query products: {e}"))?;

    let mut out = Vec::new();
    for item in rows {
        out.push(item.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn list_recent_bills(conn: &Connection, limit: i64) -> Result<Vec<BillReceipt>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT bill_no, node_id, hlc, items_json, discount_minor, total_minor, payment_mode, voided
             FROM bills
             ORDER BY hlc DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Prepare bills: {e}"))?;
    let rows = stmt
        .query_map(params![limit], |r| {
            let items_json: String = r.get(3)?;
            let voided_int: i64 = r.get(7)?;
            let items: Vec<BillItem> = serde_json::from_str(&items_json).unwrap_or_default();
            Ok(BillReceipt {
                bill_no: r.get(0)?,
                node_id: r.get(1)?,
                hlc: r.get(2)?,
                items,
                discount_minor: r.get(4)?,
                total_minor: r.get(5)?,
                payment_mode: r.get(6)?,
                voided: voided_int != 0,
            })
        })
        .map_err(|e| format!("Query bills: {e}"))?;

    let mut out = Vec::new();
    for bill in rows {
        out.push(bill.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn get_bill_by_no(conn: &Connection, bill_no: &str) -> Result<BillReceipt, String> {
    conn.query_row(
        "SELECT bill_no, node_id, hlc, items_json, discount_minor, total_minor, payment_mode, voided
         FROM bills WHERE bill_no = ?1",
        params![bill_no],
        |r| {
            let items_json: String = r.get(3)?;
            let voided_int: i64 = r.get(7)?;
            let items: Vec<BillItem> = serde_json::from_str(&items_json).unwrap_or_default();
            Ok(BillReceipt {
                bill_no: r.get(0)?,
                node_id: r.get(1)?,
                hlc: r.get(2)?,
                items,
                discount_minor: r.get(4)?,
                total_minor: r.get(5)?,
                payment_mode: r.get(6)?,
                voided: voided_int != 0,
            })
        },
    )
    .map_err(|_| format!("Bill not found: {bill_no}"))
}

pub fn count_pending_events(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM ledger_events WHERE synced_lan = 0",
        [],
        |r| r.get(0),
    )
    .map_err(|e| format!("Count pending events: {e}"))
}

pub fn events_after_hlc(conn: &Connection, since_hlc: &str) -> Result<Vec<LedgerEvent>, String> {
    events_after_hlc_limit(conn, since_hlc, 500)
}

pub fn all_ledger_events(conn: &Connection) -> Result<Vec<LedgerEvent>, String> {
    events_after_hlc_limit(conn, "", 1_000_000)
}

fn events_after_hlc_limit(
    conn: &Connection,
    since_hlc: &str,
    limit: i64,
) -> Result<Vec<LedgerEvent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT event_id, hlc, node_id, event_type, payload_json, synced_lan, synced_relay
             FROM ledger_events
             WHERE hlc > ?1
             ORDER BY hlc ASC
             LIMIT ?2",
        )
        .map_err(|e| format!("Prepare events_after_hlc: {e}"))?;
    let rows = stmt
        .query_map(params![since_hlc, limit], |r| {
            Ok(LedgerEvent {
                event_id: r.get(0)?,
                hlc: r.get(1)?,
                node_id: r.get(2)?,
                event_type: r.get(3)?,
                payload_json: r.get(4)?,
                synced_lan: r.get(5)?,
                synced_relay: r.get(6)?,
            })
        })
        .map_err(|e| format!("Query events_after_hlc: {e}"))?;

    let mut out = Vec::new();
    for ev in rows {
        out.push(ev.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
