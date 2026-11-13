use crate::ledger::{apply_ledger_event, ProductUpsertPayload};
use crate::ledger_analytics::compute_owner_analytics;
use crate::ledger_init::init_db;
use crate::ledger_suppliers::list_suppliers;
use crate::models::{BillItem, BillReceipt, LedgerEvent, ShopExpense};
use crate::printer::escpos::format_receipt_bytes;
use crate::printer::pdf_gen::generate_receipt_pdf;

#[test]
fn test_p_and_l_valuation_and_operating_profit() {
    let dir = std::env::temp_dir().join(format!("kura_test_pnl_{}", rand::random::<u32>()));
    let _ = std::fs::create_dir_all(&dir);
    let db_path = dir.join("test_pnl.db");
    let mut conn = init_db(&db_path).unwrap();

    let tx = conn.transaction().unwrap();
    // 1. Insert product with cost 1000, sell 2500, stock 10
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

    // Stock adjust: 10 units
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

    // Bill: sell 2 units -> revenue 5000, COGS 2000, profit 3000
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

    // Operating expense: 500 minor units
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
    // Revenue: 5000
    assert_eq!(a.gross_revenue_minor, 5000);
    // COGS: 2 * 1000 = 2000
    assert_eq!(a.estimated_cogs_minor, 2000);
    // Gross Profit: 5000 - 2000 = 3000
    assert_eq!(a.gross_profit_minor, 3000);
    // Expenses: 500
    assert_eq!(a.operating_expenses_minor, 500);
    // Net Operating Profit: 3000 - 500 = 2500
    assert_eq!(a.net_operating_profit_minor, 2500);

    // Remaining stock: 10 - 2 = 8 units (+ 5 starter items if seeded)
    // Valuation checks for TEST-01: 8 * 1000 = 8000 cost, 8 * 2500 = 20000 retail
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
    // Purchase 20 units of ITEM-A at unit cost 1500 (total 30000), paid 10000, due 20000
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

    // Partial supplier payment: 8000
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
    // Due was 20000, paid 8000 -> remaining 12000
    assert_eq!(s.payable_balance_minor, 12000);

    // Stock for ITEM-A should be 20
    let qty: i64 = conn.query_row("SELECT stock_qty FROM products WHERE sku = 'ITEM-A'", [], |r| r.get(0)).unwrap();
    assert_eq!(qty, 20);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn test_escpos_and_pdf_warranty_and_client_labels() {
    let bill = BillReceipt {
        bill_no: "K1-261113-0099".to_string(),
        node_id: "K1".to_string(),
        hlc: "2026-11-13T12:00:00.000Z-0001-K1".to_string(),
        items: vec![BillItem {
            sku: "SKU-WAR".to_string(),
            name: "HOCO Rapid Charger 65W".to_string(),
            qty: 1,
            unit_price_minor: 1800,
            line_total_minor: 1800,
            warranty_label: "6 Months Warranty".to_string(),
        }],
        discount_minor: 0,
        total_minor: 1800,
        payment_mode: "WALLET".to_string(),
        customer_id: None,
        client_label: "Dr. Karim".to_string(),
        cashier_label: "Cashier · K2".to_string(),
        voided: false,
    };

    // 1. ESC/POS
    let bytes = format_receipt_bytes("Kura Store", "Dhaka", "$", "Thanks", &bill, 80);
    let s = String::from_utf8_lossy(&bytes);
    assert!(s.contains("Dr. Karim (WALLET)"));
    assert!(s.contains("Cashier · K2"));
    assert!(s.contains("Warr: 6 Months Warranty"));
    assert!(s.contains("Warranty claims require this invoice"));

    // 2. PDF
    let dir = std::env::temp_dir().join(format!("kura_test_pdf_{}", rand::random::<u32>()));
    let _ = std::fs::create_dir_all(&dir);
    let res = generate_receipt_pdf(&dir, "Kura Store", "Dhaka", "$", "Thanks", &bill).unwrap();
    let pdf_bytes = std::fs::read(&res.file_path).unwrap();
    let pdf_str = String::from_utf8_lossy(&pdf_bytes);
    assert!(pdf_str.contains("Dr. Karim"));
    assert!(pdf_str.contains("Cashier: Cashier"));
    assert!(pdf_str.contains("6 Months Warranty"));
    let _ = std::fs::remove_dir_all(&dir);
}
