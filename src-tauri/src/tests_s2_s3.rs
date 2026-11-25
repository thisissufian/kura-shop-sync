use std::path::PathBuf;

use rusqlite::Connection;
use serde_json::json;

use crate::hlc::new_event_id;
use crate::ledger::apply_ledger_event;
// These tests inject unsigned owner events from simulated remote devices (pre-S4 chain).
use crate::tests_s4::init_unsecured_db as init_db;
use crate::models::LedgerEvent;

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_s23_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

fn ev(t: u32, node: &str, kind: &str, payload: serde_json::Value) -> LedgerEvent {
    let hlc = format!("2026-11-20T10:00:00.000Z-{t:04}-{node}");
    LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: node.into(),
        event_type: kind.into(),
        payload_json: payload.to_string(),
        synced_lan: 0,
        synced_relay: 0,
        sig: String::new(),
    }
}

fn product(t: u32, name: &str, cost: i64) -> LedgerEvent {
    ev(t, "KAAAA", "PRODUCT_UPSERT", json!({"sku": "SKU-X", "name": name, "barcode": null, "category": "Tea",
        "sell_price_minor": 1000, "cost_price_minor": cost, "low_stock_threshold": 3}))
}

fn bill(t: u32, no: &str, qty: i64, total: i64) -> LedgerEvent {
    let hlc = format!("2026-11-20T10:00:00.000Z-{t:04}-KBBBB");
    ev(t, "KBBBB", "BILL_ISSUED", json!({"bill_no": no, "node_id": "KBBBB", "hlc": hlc,
        "items": [{"sku": "SKU-X", "name": "Tea", "qty": qty, "unit_price_minor": 1000, "line_total_minor": total}],
        "discount_minor": 0, "total_minor": total, "payment_mode": "DUE", "customer_id": "C1"}))
}

/// Every kind of dependency the old code dropped or mis-ordered.
fn history() -> Vec<LedgerEvent> {
    vec![
        product(1, "Old Tea", 600),
        ev(1, "KAAAA", "SHOP_SETTINGS_UPDATED", json!({"shop_name": "Shop One", "shop_subtitle": "", "currency_symbol": "$", "receipt_footer": ""})),
        ev(1, "KBBBB", "CUSTOMER_UPSERT", json!({"customer_id": "C1", "name": "Rahim", "phone": "017"})),
        ev(2, "KBBBB", "STOCK_ADJUST", json!({"sku": "SKU-X", "delta": 10, "reason": "count"})),
        ev(2, "KAAAA", "STOCK_PURCHASED", json!({"purchase_id": "P1", "supplier_id": "S1", "supplier_name": "Hub",
            "sku": "SKU-X", "qty": 5, "unit_cost_minor": 700, "paid_minor": 0, "due_minor": 3500, "node_id": "KAAAA", "hlc": "x"})),
        product(3, "New Tea", 650),
        bill(4, "KBBBB-1", 2, 2000),
        bill(5, "KBBBB-2", 1, 1000),
        ev(6, "KAAAA", "BILL_VOIDED", json!({"bill_no": "KBBBB-1"})),
        ev(6, "KBBBB", "CUSTOMER_PAYMENT", json!({"payment_id": "CP1", "customer_id": "C1", "amount_minor": 300, "note": ""})),
        ev(7, "KAAAA", "SUPPLIER_PAYMENT", json!({"payment_id": "SP1", "supplier_id": "S1", "amount_minor": 500, "note": "", "node_id": "KAAAA", "hlc": "x"})),
        ev(8, "KAAAA", "SHOP_SETTINGS_UPDATED", json!({"shop_name": "Shop Two", "shop_subtitle": "", "currency_symbol": "$", "receipt_footer": ""})),
    ]
}

fn apply_each(conn: &mut Connection, events: &[LedgerEvent]) {
    for e in events {
        let tx = conn.transaction().unwrap();
        apply_ledger_event(&tx, e).unwrap();
        tx.commit().unwrap();
    }
}

fn state(conn: &Connection) -> String {
    let p: (String, i64, i64) = conn
        .query_row("SELECT name, stock_qty, cost_price_minor FROM products WHERE sku = 'SKU-X'", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .unwrap();
    let c: (String, i64) = conn.query_row("SELECT name, balance_due_minor FROM customers WHERE customer_id = 'C1'", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
    let s: (String, i64) = conn.query_row("SELECT name, payable_balance_minor FROM suppliers WHERE supplier_id = 'S1'", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
    let v: String = conn.query_row("SELECT group_concat(bill_no || ':' || voided, ',') FROM (SELECT * FROM bills WHERE bill_no LIKE 'KBBBB-%' ORDER BY bill_no)", [], |r| r.get(0)).unwrap();
    let shop: String = conn.query_row("SELECT shop_name FROM chain_config WHERE id = 1", [], |r| r.get(0)).unwrap();
    format!("{p:?} {c:?} {s:?} {v} {shop}")
}

#[test]
fn test_any_delivery_order_converges_to_the_same_state() {
    let expected = "(\"New Tea\", 14, 650) (\"Rahim\", 700) (\"Hub\", 3000) KBBBB-1:1,KBBBB-2:0 Shop Two";
    let orders: Vec<Vec<LedgerEvent>> = {
        let h = history();
        let mut rev = h.clone();
        rev.reverse();
        let mut shuffled = h.clone();
        shuffled.rotate_left(5);
        vec![h, rev, shuffled]
    };
    for (i, order) in orders.iter().enumerate() {
        let path = temp_db(&format!("order{i}"));
        let mut conn = init_db(&path).unwrap();
        apply_each(&mut conn, order);
        assert_eq!(state(&conn), expected, "delivery order #{i} diverged");
        drop(conn);
        let _ = std::fs::remove_dir_all(path.parent().unwrap());
    }
}

#[test]
fn test_stock_events_do_not_block_older_product_edit() {
    // Device saw a sale (t=5) before the owner's rename (t=3) arrived.
    let path = temp_db("lww");
    let mut conn = init_db(&path).unwrap();
    apply_each(&mut conn, &[product(1, "Old Tea", 600), bill(5, "KBBBB-9", 1, 1000), product(3, "New Tea", 600)]);
    let name: String = conn.query_row("SELECT name FROM products WHERE sku = 'SKU-X'", [], |r| r.get(0)).unwrap();
    assert_eq!(name, "New Tea");
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

#[test]
fn test_upgrade_rebuild_repairs_existing_projections() {
    let path = temp_db("rebuild");
    let mut conn = init_db(&path).unwrap();
    let mut h = history();
    h.reverse();
    apply_each(&mut conn, &h);
    // Simulate damage left by the old projection rules, then an old schema version.
    conn.execute_batch("UPDATE products SET name = 'Old Tea', stock_qty = 99 WHERE sku = 'SKU-X';
                        UPDATE customers SET balance_due_minor = 0; PRAGMA user_version = 0;").unwrap();
    drop(conn);
    let conn = init_db(&path).unwrap();
    assert_eq!(state(&conn), "(\"New Tea\", 14, 650) (\"Rahim\", 700) (\"Hub\", 3000) KBBBB-1:1,KBBBB-2:0 Shop Two");
    let starters: i64 = conn.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap();
    assert_eq!(starters, 24, "starter stock must survive the replay");
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
