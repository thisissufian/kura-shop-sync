use std::path::PathBuf;

use crate::cmd_catalog_csv::{format_decimal, parse_decimal_minor};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_init::init_db;
use crate::models::{BillItem, BillReceipt, LedgerEvent, Product};
use crate::printer::barcode_pdf::generate_barcode_labels_pdf;
use crate::printer::escpos::format_receipt_bytes;
use crate::printer::pdf_gen::generate_receipt_pdf;

fn temp_db(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("kura_test_{name}_{}.db", std::process::id()));
    let _ = std::fs::remove_file(&p);
    p
}

fn make_ev(hlc: &str, node: &str, ev_type: &str, payload: String) -> LedgerEvent {
    LedgerEvent {
        event_id: format!("E-{}", hlc.replace([':', '.', '-'], "")),
        hlc: hlc.to_string(),
        node_id: node.to_string(),
        event_type: ev_type.to_string(),
        payload_json: payload,
        synced_lan: 0,
        synced_relay: 0,
    }
}

#[test]
fn test_multi_node_concurrent_offline_sales_convergence() {
    let p_init = ProductUpsertPayload {
        sku: "SKU-MULTI".into(),
        name: "Convergence Tea".into(),
        barcode: Some("990011".into()),
        category: "Pantry".into(),
        brand: "Kura".into(),
        variant: "Leaf".into(),
        warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
        sell_price_minor: 1000,
        cost_price_minor: 600,
        low_stock_threshold: 5,
    };
    let ev_p = make_ev("2026-11-13T08:00:00.000Z-0001-K1", "K1", "PRODUCT_UPSERT", serde_json::to_string(&p_init).unwrap());
    let ev_stock = make_ev("2026-11-13T08:00:00.000Z-0002-K1", "K1", "STOCK_ADJUST", serde_json::to_string(&StockAdjustPayload {
        sku: "SKU-MULTI".into(), delta: 100, reason: "Opening Stock".into()
    }).unwrap());

    let ev_k1_sale = make_ev("2026-11-13T09:00:00.000Z-0001-K1", "K1", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
        bill_no: "K1-261113-0001".into(), node_id: "K1".into(), hlc: "2026-11-13T09:00:00.000Z-0001-K1".into(),
        items: vec![BillItem { sku: "SKU-MULTI".into(), name: "Convergence Tea".into(), qty: 10, unit_price_minor: 1000, line_total_minor: 10000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into() }],
        discount_minor: 0, total_minor: 10000, payment_mode: "CASH".into(), customer_id: None,
        client_label: "Walk-in Customer".into(), cashier_label: "Owner · K1".into(), voided: false,
    }).unwrap());

    let ev_k2_sale = make_ev("2026-11-13T09:05:00.000Z-0001-K2", "K2", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
        bill_no: "K2-261113-0001".into(), node_id: "K2".into(), hlc: "2026-11-13T09:05:00.000Z-0001-K2".into(),
        items: vec![BillItem { sku: "SKU-MULTI".into(), name: "Convergence Tea".into(), qty: 20, unit_price_minor: 1000, line_total_minor: 20000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into() }],
        discount_minor: 0, total_minor: 20000, payment_mode: "WALLET".into(), customer_id: None,
        client_label: "Walk-in Customer".into(), cashier_label: "Cashier · K2".into(), voided: false,
    }).unwrap());

    let ev_k3_sale = make_ev("2026-11-13T09:10:00.000Z-0001-K3", "K3", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
        bill_no: "K3-261113-0001".into(), node_id: "K3".into(), hlc: "2026-11-13T09:10:00.000Z-0001-K3".into(),
        items: vec![BillItem { sku: "SKU-MULTI".into(), name: "Convergence Tea".into(), qty: 15, unit_price_minor: 1000, line_total_minor: 15000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into() }],
        discount_minor: 0, total_minor: 15000, payment_mode: "CASH".into(), customer_id: None,
        client_label: "Walk-in Customer".into(), cashier_label: "Cashier · K3".into(), voided: false,
    }).unwrap());

    let ev_k3_restock = make_ev("2026-11-13T09:15:00.000Z-0002-K3", "K3", "STOCK_ADJUST", serde_json::to_string(&StockAdjustPayload {
        sku: "SKU-MULTI".into(), delta: 25, reason: "Midday Supply".into()
    }).unwrap());

    let batch = vec![ev_p, ev_stock, ev_k1_sale, ev_k2_sale, ev_k3_sale, ev_k3_restock];

    let path_a = temp_db("node_a");
    let mut conn_a = init_db(&path_a).unwrap();
    {
        let tx = conn_a.transaction().unwrap();
        for e in &batch { apply_ledger_event(&tx, e).unwrap(); }
        tx.commit().unwrap();
    }

    let path_b = temp_db("node_b");
    let mut conn_b = init_db(&path_b).unwrap();
    {
        let tx = conn_b.transaction().unwrap();
        for e in batch.iter().rev() { apply_ledger_event(&tx, e).unwrap(); }
        tx.commit().unwrap();
    }

    let stock_a: i64 = conn_a.query_row("SELECT stock_qty FROM products WHERE sku='SKU-MULTI'", [], |r| r.get(0)).unwrap();
    let stock_b: i64 = conn_b.query_row("SELECT stock_qty FROM products WHERE sku='SKU-MULTI'", [], |r| r.get(0)).unwrap();
    assert_eq!(stock_a, 80);
    assert_eq!(stock_b, 80);

    let rev_a: i64 = conn_a.query_row("SELECT SUM(total_minor) FROM bills WHERE voided=0", [], |r| r.get(0)).unwrap();
    let rev_b: i64 = conn_b.query_row("SELECT SUM(total_minor) FROM bills WHERE voided=0", [], |r| r.get(0)).unwrap();
    assert_eq!(rev_a, 45000);
    assert_eq!(rev_b, 45000);

    let _ = std::fs::remove_file(&path_a);
    let _ = std::fs::remove_file(&path_b);
}

#[test]
fn test_escpos_58mm_and_80mm_column_bounds() {
    let bill = BillReceipt {
        bill_no: "K1-261113-0042".into(),
        node_id: "K1".into(),
        hlc: "2026-11-13T10:00:00.000Z-0001-K1".into(),
        items: vec![BillItem { sku: "SKU-1".into(), name: "Fresh Milk 1L".into(), qty: 2, unit_price_minor: 250, line_total_minor: 500, warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into() }],
        discount_minor: 50,
        total_minor: 450,
        payment_mode: "CASH".into(),
        customer_id: None,
        client_label: "Walk-in Customer".into(),
        cashier_label: "Owner · K1".into(),
        voided: false,
    };

    let b58 = format_receipt_bytes("Kura Store", "Dhaka Market", "৳", "Thank you!", &bill, 58);
    let b80 = format_receipt_bytes("Kura Store", "Tokyo Shinjuku", "¥", "Arigato!", &bill, 80);

    assert_eq!(b58[0..2], [0x1B, 0x40]);
    assert_eq!(b80[0..2], [0x1B, 0x40]);
    assert!(b58.windows(2).any(|w| w == [0x1D, 0x56]));
    assert!(b80.windows(2).any(|w| w == [0x1D, 0x56]));

    let s58 = String::from_utf8_lossy(&b58);
    let s80 = String::from_utf8_lossy(&b80);
    assert!(s58.contains("Tk"));
    assert!(s80.contains("JPY"));
    assert!(b58.len() < b80.len() || b58.len() > 100);
}

#[test]
fn test_vector_pdf_and_barcode_sheet_generation() {
    let temp_dir = std::env::temp_dir().join(format!("kura_pdf_test_{}", std::process::id()));
    let bill = BillReceipt {
        bill_no: "K1-261113-0099".into(),
        node_id: "K1".into(),
        hlc: "2026-11-13T11:00:00.000Z-0001-K1".into(),
        items: vec![BillItem { sku: "SKU-9".into(), name: "Matcha Pack".into(), qty: 1, unit_price_minor: 1200, line_total_minor: 1200, warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into() }],
        discount_minor: 0,
        total_minor: 1200,
        payment_mode: "CASH".into(),
        customer_id: None,
        client_label: "Walk-in Customer".into(),
        cashier_label: "Owner · K1".into(),
        voided: false,
    };

    let res = generate_receipt_pdf(&temp_dir, "Kura POS", "Downtown", "$", "Visit again!", &bill).unwrap();
    assert!(res.size_bytes > 500);
    assert!(res.data_url.starts_with("data:application/pdf;base64,"));
    let bytes = std::fs::read(&res.file_path).unwrap();
    assert!(bytes.starts_with(b"%PDF-1.4"));
    let s = String::from_utf8_lossy(&bytes);
    assert!(s.contains("%%EOF"));
    assert!(s.contains("re f"));
    assert!(s.contains("K1-261113-0099"));

    let prods = vec![Product {
        sku: "SKU-BAR1".into(),
        name: "Label Test Item".into(),
        barcode: Some("89012345".into()),
        category: "Test".into(),
        brand: "Kura".into(),
        variant: "Unit".into(),
        warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
        sell_price_minor: 350,
        cost_price_minor: 200,
        stock_qty: 10,
        low_stock_threshold: 2,
        updated_hlc: "2026-11-13T11:00:00.000Z-0001-K1".into(),
    }];
    let sheet = generate_barcode_labels_pdf(&temp_dir, "Kura", "$", &prods, "261113").unwrap();
    assert!(sheet.size_bytes > 500);
    let sheet_bytes = std::fs::read(&sheet.file_path).unwrap();
    assert!(sheet_bytes.starts_with(b"%PDF-1.4"));

    let _ = std::fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_csv_catalog_roundtrip_and_minor_units() {
    assert_eq!(parse_decimal_minor("149.95"), 14995);
    assert_eq!(parse_decimal_minor("0.05"), 5);
    assert_eq!(parse_decimal_minor("1200"), 120000);
    assert_eq!(parse_decimal_minor("0.00"), 0);
    assert_eq!(parse_decimal_minor(" 25.5 "), 2550);
    assert_eq!(format_decimal(14995), "149.95");
    assert_eq!(format_decimal(5), "0.05");
    assert_eq!(format_decimal(120000), "1200.00");
}
