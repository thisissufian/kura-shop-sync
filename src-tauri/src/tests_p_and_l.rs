use crate::ledger::{apply_ledger_event, ProductUpsertPayload};
use crate::ledger_analytics::compute_owner_analytics;
use crate::ledger_init::init_db;
use crate::ledger_suppliers::list_suppliers;
use crate::models::{BillItem, BillReceipt, LedgerEvent, ShopExpense};

#[test]
fn test_p_and_l_valuation_and_operating_profit() {
    let dir = std::env::temp_dir().join(format!("kura_test_pnl_{}", rand::random::<u32>()));
    let _ = std::fs::create_dir_all(&dir);
    let db_path = dir.join("test_pnl.db");
    let mut conn = init_db(&db_path).unwrap();

    let tx = conn.transaction().unwrap();
    let p = ProductUpsertPayload {
        sku: "TEST-01".to_string(),
        name: "Wireless ANC Headphones".to_string(),
        barcode: Some("123456789".to_string()),
        category: "Audio".to_string(),
        brand: "Anker".to_string(),
        variant: "Midnight Black".to_string(),
        warranty_label: "1 Year Official Warranty".to_string(),
        sell_price_minor: 2500,
        cost_price_minor: 1000,
        low_stock_threshold: 3,
    };
    let ev_p = LedgerEvent {
        event_id: "E-P1".to_string(),
        hlc: "2026-11-13T10:00:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "PRODUCT_UPSERT".to_string(),
        payload_json: serde_json::to_string(&p).unwrap(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_p).unwrap();

    let ev_stock = LedgerEvent {
        event_id: "E-S1".to_string(),
        hlc: "2026-11-13T10:01:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "STOCK_ADJUST".to_string(),
        payload_json: r#"{"sku":"TEST-01","delta":10,"reason":"Opening"}"#.to_string(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_stock).unwrap();

    let bill = BillReceipt {
        bill_no: "K1-261113-0001".to_string(),
        node_id: "K1".to_string(),
        hlc: "2026-11-13T10:05:00.000Z-0001-K1".to_string(),
        items: vec![BillItem {
            sku: "TEST-01".to_string(),
            name: "Wireless ANC Headphones".to_string(),
            qty: 2,
            unit_price_minor: 2500,
            line_total_minor: 5000,
            warranty_label: "1 Year Official Warranty".to_string(),
        }],
        discount_minor: 0,
        total_minor: 5000,
        payment_mode: "CASH".to_string(),
        customer_id: None,
        client_label: "Walk-in Customer".to_string(),
        cashier_label: "Owner · K1".to_string(),
        voided: false,
    };
    let ev_bill = LedgerEvent {
        event_id: "E-B1".to_string(),
        hlc: "2026-11-13T10:05:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "BILL_ISSUED".to_string(),
        payload_json: serde_json::to_string(&bill).unwrap(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_bill).unwrap();

    let exp = ShopExpense {
        expense_id: "EXP-1".to_string(),
        category: "Supplies".to_string(),
        amount_minor: 500,
        note: "Packaging tape".to_string(),
        node_id: "K1".to_string(),
        hlc: "2026-11-13T10:10:00.000Z-0001-K1".to_string(),
    };
    let ev_exp = LedgerEvent {
        event_id: "E-E1".to_string(),
        hlc: "2026-11-13T10:10:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "EXPENSE_LOGGED".to_string(),
        payload_json: serde_json::to_string(&exp).unwrap(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_exp).unwrap();

    tx.commit().unwrap();

    let a = compute_owner_analytics(&conn, "TODAY").unwrap();
    assert_eq!(a.gross_revenue_minor, 5000);
    assert_eq!(a.estimated_cogs_minor, 2000);
    assert_eq!(a.gross_profit_minor, 3000);
    assert_eq!(a.operating_expenses_minor, 500);
    assert_eq!(a.net_operating_profit_minor, 2500);

    assert!(a.inventory_cost_value_minor >= 8000);
    assert!(a.retail_market_value_minor >= 20000);
    assert!(!a.daily_trend.is_empty());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn test_supplier_payables_and_stock_purchased_flow() {
    let dir = std::env::temp_dir().join(format!("kura_test_supp_{}", rand::random::<u32>()));
    let _ = std::fs::create_dir_all(&dir);
    let db_path = dir.join("test_supp.db");
    let mut conn = init_db(&db_path).unwrap();

    let tx = conn.transaction().unwrap();
    let ev_po = LedgerEvent {
        event_id: "E-PO1".to_string(),
        hlc: "2026-11-13T11:00:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "STOCK_PURCHASED".to_string(),
        payload_json: r#"{
            "purchase_id":"PO-1",
            "supplier_id":"SUP-01",
            "supplier_name":"Anker Official Distributor",
            "supplier_phone":"01700000000",
            "sku":"ITEM-A",
            "qty":20,
            "unit_cost_minor":1500,
            "paid_minor":10000,
            "due_minor":20000,
            "node_id":"K1",
            "hlc":"2026-11-13T11:00:00.000Z-0001-K1"
        }"#.to_string(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_po).unwrap();

    let ev_pay = LedgerEvent {
        event_id: "E-SP1".to_string(),
        hlc: "2026-11-13T11:30:00.000Z-0001-K1".to_string(),
        node_id: "K1".to_string(),
        event_type: "SUPPLIER_PAYMENT".to_string(),
        payload_json: r#"{
            "payment_id":"SP-1",
            "supplier_id":"SUP-01",
            "amount_minor":8000,
            "note":"Bank Transfer",
            "node_id":"K1",
            "hlc":"2026-11-13T11:30:00.000Z-0001-K1"
        }"#.to_string(),
        synced_lan: 0,
        synced_relay: 0,
    };
    apply_ledger_event(&tx, &ev_pay).unwrap();
    tx.commit().unwrap();

    let supps = list_suppliers(&conn).unwrap();
    let s = supps.iter().find(|x| x.supplier_id == "SUP-01").unwrap();
    assert_eq!(s.name, "Anker Official Distributor");
    assert_eq!(s.payable_balance_minor, 12000);

    let qty: i64 = conn.query_row("SELECT stock_qty FROM products WHERE sku = 'ITEM-A'", [], |r| r.get(0)).unwrap();
    assert_eq!(qty, 20);
    let _ = std::fs::remove_dir_all(&dir);
}
