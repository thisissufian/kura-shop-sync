use std::path::PathBuf;

use crate::crypto_chain::{decrypt_events, encrypt_events, generate_seed};
use crate::hlc::{new_event_id, next_hlc, observe_remote_hlc};
use crate::ledger::{apply_ledger_event, BillVoidPayload, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_customers::{get_customer_by_id, CustomerPaymentPayload, CustomerUpsertPayload};
use crate::ledger_expenses::{build_cash_drawer_summary, ExpenseLoggedPayload};
use crate::ledger_init::init_db;
use crate::mnemonic::{phrase_to_seed, seed_to_phrase};
use crate::models::{BillItem, BillReceipt, LedgerEvent};

fn temp_db_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("kura_test_{}_{name}.db", std::process::id()))
}

fn ev(hlc: &str, node: &str, kind: &str, payload_json: String) -> LedgerEvent {
    LedgerEvent {
        event_id: new_event_id(hlc),
        hlc: hlc.to_string(),
        node_id: node.to_string(),
        event_type: kind.to_string(),
        payload_json,
        synced_lan: 0,
        synced_relay: 0,
    }
}

#[test]
fn test_hlc_monotonic_and_remote_drift() {
    let path = temp_db_path("hlc");
    let conn = init_db(&path).expect("init_db");
    let h1 = next_hlc(&conn, "K1").expect("h1");
    let h2 = next_hlc(&conn, "K1").expect("h2");
    assert!(h2 > h1, "HLC must strictly increase: {h1} vs {h2}");

    let future_remote = "2099-01-01T00:00:00.000Z-0005-K2";
    let merged = observe_remote_hlc(&conn, future_remote, "K1").expect("observe");
    assert!(merged.as_str() > future_remote, "Must advance past remote drift");

    let h3 = next_hlc(&conn, "K1").expect("h3");
    assert!(h3 > merged, "Local clock after drift must continue monotonically");
    let _ = std::fs::remove_file(&path);
}

#[test]
fn test_crdt_ledger_replay_stock_khata_and_drawer() {
    let path = temp_db_path("crdt");
    let mut conn = init_db(&path).expect("init_db");

    let events = vec![
        ev("2026-11-12T10:00:00.000Z-0001-K1", "K1", "PRODUCT_UPSERT", serde_json::to_string(&ProductUpsertPayload {
            sku: "SKU-T1".into(), name: "Test Tea".into(), barcode: Some("123456".into()),
            category: "Beverages".into(), sell_price_minor: 500, cost_price_minor: 300, low_stock_threshold: 2,
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0002-K1", "K1", "STOCK_ADJUST", serde_json::to_string(&StockAdjustPayload {
            sku: "SKU-T1".into(), delta: 10, reason: "init".into(),
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0003-K1", "K1", "CUSTOMER_UPSERT", serde_json::to_string(&CustomerUpsertPayload {
            customer_id: "C-T1".into(), name: "Ali".into(), phone: "01700000000".into(),
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0004-K1", "K1", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
            bill_no: "K1-261112-0001".into(), node_id: "K1".into(), hlc: "2026-11-12T10:00:00.000Z-0004-K1".into(),
            items: vec![BillItem { sku: "SKU-T1".into(), name: "Test Tea".into(), qty: 2, unit_price_minor: 500, line_total_minor: 1000 }],
            discount_minor: 0, total_minor: 1000, payment_mode: "CASH".into(), customer_id: None, voided: false,
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0005-K2", "K2", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
            bill_no: "K2-261112-0001".into(), node_id: "K2".into(), hlc: "2026-11-12T10:00:00.000Z-0005-K2".into(),
            items: vec![BillItem { sku: "SKU-T1".into(), name: "Test Tea".into(), qty: 3, unit_price_minor: 500, line_total_minor: 1500 }],
            discount_minor: 0, total_minor: 1500, payment_mode: "DUE".into(), customer_id: Some("C-T1".into()), voided: false,
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0006-K1", "K1", "BILL_ISSUED", serde_json::to_string(&BillReceipt {
            bill_no: "K1-261112-0002".into(), node_id: "K1".into(), hlc: "2026-11-12T10:00:00.000Z-0006-K1".into(),
            items: vec![BillItem { sku: "SKU-T1".into(), name: "Test Tea".into(), qty: 1, unit_price_minor: 500, line_total_minor: 500 }],
            discount_minor: 0, total_minor: 500, payment_mode: "CASH".into(), customer_id: None, voided: false,
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0007-K1", "K1", "BILL_VOIDED", serde_json::to_string(&BillVoidPayload {
            bill_no: "K1-261112-0002".into(),
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0008-K1", "K1", "CUSTOMER_PAYMENT", serde_json::to_string(&CustomerPaymentPayload {
            payment_id: "P-1".into(), customer_id: "C-T1".into(), amount_minor: 400, note: "partial".into(),
        }).unwrap()),
        ev("2026-11-12T10:00:00.000Z-0009-K1", "K1", "EXPENSE_LOGGED", serde_json::to_string(&ExpenseLoggedPayload {
            expense_id: "EXP-1".into(), category: "Supplies".into(), amount_minor: 250,
            note: "cups".into(), node_id: "K1".into(), hlc: "2026-11-12T10:00:00.000Z-0009-K1".into(),
        }).unwrap()),
    ];

    {
        let tx = conn.transaction().unwrap();
        for e in &events {
            assert!(apply_ledger_event(&tx, e).unwrap(), "First apply must insert");
        }
        for e in &events {
            assert!(!apply_ledger_event(&tx, e).unwrap(), "Replay must be idempotent");
        }
        tx.commit().unwrap();
    }

    let stock: i64 = conn.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-T1'", [], |r| r.get(0)).unwrap();
    assert_eq!(stock, 5);
    assert_eq!(get_customer_by_id(&conn, "C-T1").unwrap().balance_due_minor, 1100);

    let drawer = build_cash_drawer_summary(&conn).unwrap();
    assert_eq!(drawer.cash_sales_minor, 1000);
    assert_eq!(drawer.due_issued_minor, 1500);
    assert_eq!(drawer.khata_cash_collected_minor, 400);
    assert_eq!(drawer.total_expenses_minor, 250);
    assert_eq!(drawer.expected_drawer_cash_minor, 1150);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn test_aes_gcm_roundtrip_and_mnemonic_recovery() {
    let seed = generate_seed();
    let phrase = seed_to_phrase(&seed);
    assert_eq!(phrase.split_whitespace().count(), 12);
    let recovered = phrase_to_seed(&phrase).expect("valid 12-word phrase");
    assert_eq!(seed, recovered);
    assert!(phrase_to_seed("baba baba baba baba baba baba baba baba baba baba baba baba").is_err());

    let sample = vec![ev("2026-11-12T10:00:00.000Z-0001-K1", "K1", "STOCK_ADJUST", "{\"sku\":\"A\",\"delta\":1,\"reason\":\"r\"}".into())];
    let packet = encrypt_events(&seed, &sample).expect("encrypt");
    let decoded = decrypt_events(&recovered, &packet).expect("decrypt");
    assert_eq!(decoded.len(), 1);
    assert_eq!(decoded[0].event_id, sample[0].event_id);

    let wrong_seed = [9u8; 16];
    assert!(decrypt_events(&wrong_seed, &packet).is_err());
}
