use rusqlite::Connection;
use std::path::PathBuf;

use crate::cmd_billing::{create_bill, find_bill_for_device, recent_bills_for_device};
use crate::hlc::{format_iso_ms, new_event_id, next_hlc};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_analytics::compute_owner_analytics;
// These tests inject unsigned owner events from simulated remote devices (pre-S4 chain).
use crate::tests_s4::init_unsecured_db as init_db;
use crate::ledger_suppliers::StockPurchasePayload;
use crate::models::{BillItem, IssueBillInput, IssueBillItemInput, LedgerEvent};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_t3_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

fn seed_sku(conn: &mut Connection, sku: &str, sell: i64, cost: i64, qty: i64) {
    let h1 = next_hlc(conn, "K1").unwrap();
    let up = ProductUpsertPayload {
        sku: sku.into(),
        name: "Test Item".into(),
        barcode: None,
        category: "General".into(),
        brand: "Kura".into(),
        variant: "Std".into(),
        warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
        sell_price_minor: sell,
        cost_price_minor: cost,
        low_stock_threshold: 2,
    };
    let ev1 = LedgerEvent {
        event_id: new_event_id(&h1),
        hlc: h1,
        node_id: "K1".into(),
        event_type: "PRODUCT_UPSERT".into(),
        payload_json: serde_json::to_string(&up).unwrap(),
        synced_lan: 0,
        synced_relay: 0,
        sig: String::new(),
    };
    let h2 = next_hlc(conn, "K1").unwrap();
    let adj = StockAdjustPayload { sku: sku.into(), delta: qty, reason: "Opening".into() };
    let ev2 = LedgerEvent {
        event_id: new_event_id(&h2),
        hlc: h2,
        node_id: "K1".into(),
        event_type: "STOCK_ADJUST".into(),
        payload_json: serde_json::to_string(&adj).unwrap(),
        synced_lan: 0,
        synced_relay: 0,
        sig: String::new(),
    };
    let tx = conn.transaction().unwrap();
    apply_ledger_event(&tx, &ev1).unwrap();
    apply_ledger_event(&tx, &ev2).unwrap();
    tx.commit().unwrap();
}

#[test]
fn test_historical_cogs_unchanged_after_cost_increase() {
    let path = temp_db("cogs_snapshot");
    let mut conn = init_db(&path).unwrap();
    seed_sku(&mut conn, "SKU-T3", 1000, 600, 10);

    let bill = create_bill(
        &mut conn,
        IssueBillInput {
            items: vec![IssueBillItemInput { sku: "SKU-T3".into(), qty: 2, warranty_label: None }],
            discount_minor: 0,
            payment_mode: "CASH".into(),
            customer_id: None,
            client_label: None,
            cashier_label: None,
        },
    )
    .unwrap();
    assert_eq!(bill.items[0].unit_cost_minor, Some(600));

    // Restock at a higher cost (900) via STOCK_PURCHASED
    let h3 = next_hlc(&conn, "K1").unwrap();
    let purchase = StockPurchasePayload {
        purchase_id: "PO-T3".into(),
        supplier_id: "SUP-T3".into(),
        supplier_name: "Supplier".into(),
        supplier_phone: String::new(),
        sku: "SKU-T3".into(),
        qty: 5,
        unit_cost_minor: 900,
        paid_minor: 4500,
        due_minor: 0,
        node_id: "K1".into(),
        hlc: h3.clone(),
    };
    let tx = conn.transaction().unwrap();
    apply_ledger_event(
        &tx,
        &LedgerEvent {
            event_id: new_event_id(&h3),
            hlc: h3,
            node_id: "K1".into(),
            event_type: "STOCK_PURCHASED".into(),
            payload_json: serde_json::to_string(&purchase).unwrap(),
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        },
    )
    .unwrap();
    tx.commit().unwrap();

    // Historical bill COGS must still use 600 (2 * 600 = 1200), not 900 (1800)
    let a = compute_owner_analytics(&conn, "ALL").unwrap();
    assert_eq!(a.gross_revenue_minor, 2000);
    assert_eq!(a.estimated_cogs_minor, 1200);
    assert_eq!(a.gross_profit_minor, 800);
    let today_pt = a.daily_trend.last().unwrap();
    assert_eq!(today_pt.revenue_minor, 2000);
    assert_eq!(today_pt.profit_minor, 800);

    // Legacy bill event lacking `unit_cost_minor` still parses and falls back to current cost (900)
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let legacy_hlc = format!("{}-0099-K1", format_iso_ms(now_ms));
    let legacy_json = serde_json::json!({
        "bill_no": "K1-LEGACY-0001",
        "node_id": "K1",
        "hlc": legacy_hlc,
        "items": [{"sku": "SKU-T3", "name": "Test Item", "qty": 1, "unit_price_minor": 1000, "line_total_minor": 1000}],
        "discount_minor": 0,
        "total_minor": 1000,
        "payment_mode": "CASH",
        "voided": false
    })
    .to_string();
    let tx2 = conn.transaction().unwrap();
    apply_ledger_event(
        &tx2,
        &LedgerEvent {
            event_id: "ev-legacy-bill".into(),
            hlc: legacy_hlc,
            node_id: "K1".into(),
            event_type: "BILL_ISSUED".into(),
            payload_json: legacy_json,
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        },
    )
    .unwrap();
    tx2.commit().unwrap();

    let a2 = compute_owner_analytics(&conn, "ALL").unwrap();
    assert_eq!(a2.gross_revenue_minor, 3000);
    assert_eq!(a2.estimated_cogs_minor, 2100);
    assert_eq!(a2.gross_profit_minor, 900);

    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

#[test]
fn test_cashier_redacts_unit_cost_minor_on_bill_views() {
    let path = temp_db("cashier_redact");
    let mut conn = init_db(&path).unwrap();
    seed_sku(&mut conn, "SKU-SEC", 1000, 600, 10);

    conn.execute("UPDATE chain_config SET role = 'CASHIER' WHERE id = 1", []).unwrap();
    let returned = create_bill(
        &mut conn,
        IssueBillInput {
            items: vec![IssueBillItemInput { sku: "SKU-SEC".into(), qty: 1, warranty_label: None }],
            discount_minor: 0,
            payment_mode: "CASH".into(),
            customer_id: None,
            client_label: None,
            cashier_label: None,
        },
    )
    .unwrap();
    assert_eq!(returned.items[0].unit_cost_minor, None, "issue_bill must redact cost for CASHIER");

    let recent = recent_bills_for_device(&conn).unwrap();
    assert_eq!(recent[0].items[0].unit_cost_minor, None, "get_recent_bills must redact cost for CASHIER");
    let found = find_bill_for_device(&conn, &returned.bill_no).unwrap().unwrap();
    assert_eq!(found.items[0].unit_cost_minor, None, "find_bill_by_no must redact cost for CASHIER");

    // Stored ledger/bill JSON still retains 600 for OWNER sync & P&L
    let stored_json: String = conn
        .query_row("SELECT items_json FROM bills WHERE bill_no = ?1", [&returned.bill_no], |r| r.get(0))
        .unwrap();
    let stored_items: Vec<BillItem> = serde_json::from_str(&stored_json).unwrap();
    assert_eq!(stored_items[0].unit_cost_minor, Some(600));

    conn.execute("UPDATE chain_config SET role = 'OWNER' WHERE id = 1", []).unwrap();
    assert_eq!(recent_bills_for_device(&conn).unwrap()[0].items[0].unit_cost_minor, Some(600));
    assert_eq!(find_bill_for_device(&conn, &returned.bill_no).unwrap().unwrap().items[0].unit_cost_minor, Some(600));

    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
