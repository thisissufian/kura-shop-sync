use std::path::PathBuf;

use crate::cmd_billing::create_bill;
use crate::cmd_sync_print::{apply_join_chain_db, has_local_business_data};
use crate::crypto_chain::build_pairing_uri;
use crate::ledger::apply_ledger_event;
use crate::ledger_init::{init_db, STARTER_EVENT_COUNT};
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::models::{IssueBillInput, IssueBillItemInput};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_t5_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

#[test]
fn test_join_chain_clears_starter_stock_and_avoids_doubling() {
    let path_a = temp_db("owner_a");
    let path_b = temp_db("joiner_b");
    let conn_a = init_db(&path_a).unwrap();
    let mut conn_b = init_db(&path_b).unwrap();

    let events_a = all_ledger_events(&conn_a).unwrap();
    assert_eq!(events_a.len(), STARTER_EVENT_COUNT, "Fresh DB A should have STARTER_EVENT_COUNT starter events");
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), STARTER_EVENT_COUNT);
    assert!(!has_local_business_data(&conn_b).unwrap());

    let cfg_a = get_chain_config(&conn_a).unwrap();
    let uri_a = build_pairing_uri(&[0u8; 16], &cfg_a.seed_b64, "CASHIER", "K3", &cfg_a.shop_name, "");

    // Invalid URI must fail without deleting any local data
    assert!(apply_join_chain_db(&mut conn_b, "invalid-uri", None, false).is_err());
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), STARTER_EVENT_COUNT);

    // Fresh starter-only device joins without force_reset
    apply_join_chain_db(&mut conn_b, &uri_a, None, false).unwrap();

    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 0, "Joined DB B must clear local starter events");
    for tbl in ["products", "bills", "customers", "suppliers", "expenses"] {
        let cnt: i64 = conn_b.query_row(&format!("SELECT COUNT(*) FROM {tbl}"), [], |r| r.get(0)).unwrap();
        assert_eq!(cnt, 0, "Joined DB B must clear {tbl} before sync");
    }
    let cfg_b = get_chain_config(&conn_b).unwrap();
    assert!(cfg_b.is_linked);
    assert_eq!(cfg_b.last_hlc, "", "last_hlc must reset before syncing");
    assert_eq!(cfg_b.seed_b64, cfg_a.seed_b64);

    // Re-opening DB B via init_db before sync must NOT re-seed starter inventory
    drop(conn_b);
    let mut conn_b = init_db(&path_b).unwrap();
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 0, "init_db must not re-seed a linked device");

    {
        let tx = conn_b.transaction().unwrap();
        for ev in &events_a {
            apply_ledger_event(&tx, ev).unwrap();
        }
        tx.commit().unwrap();
    }

    let stock_a: i64 = conn_a.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap();
    let stock_b: i64 = conn_b.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap();
    assert_eq!(stock_a, 24);
    assert_eq!(stock_b, stock_a, "Stock on B must equal A's stock (not doubled to 48)");
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), events_a.len());

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
}

#[test]
fn test_join_chain_requires_force_reset_when_already_linked() {
    let path_a = temp_db("linked_a");
    let path_b = temp_db("linked_b");
    let path_c = temp_db("linked_c");
    let conn_a = init_db(&path_a).unwrap();
    let mut conn_b = init_db(&path_b).unwrap();
    let conn_c = init_db(&path_c).unwrap();

    let cfg_a = get_chain_config(&conn_a).unwrap();
    let uri_a = build_pairing_uri(&[0u8; 16], &cfg_a.seed_b64, "CASHIER", "K3", "Shop A", "");
    apply_join_chain_db(&mut conn_b, &uri_a, None, false).unwrap();

    let events_a = all_ledger_events(&conn_a).unwrap();
    {
        let tx = conn_b.transaction().unwrap();
        for ev in &events_a {
            apply_ledger_event(&tx, ev).unwrap();
        }
        tx.commit().unwrap();
    }

    let cfg_c = get_chain_config(&conn_c).unwrap();
    let uri_c = build_pairing_uri(&[0u8; 16], &cfg_c.seed_b64, "CASHIER", "K3", "Shop C", "");

    let err = apply_join_chain_db(&mut conn_b, &uri_c, None, false).unwrap_err();
    assert!(err.contains("CONFIRM_RESET"), "Expected reset confirmation error, got: {err}");
    assert_eq!(get_chain_config(&conn_b).unwrap().seed_b64, cfg_a.seed_b64);
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), events_a.len());

    apply_join_chain_db(&mut conn_b, &uri_c, None, true).unwrap();
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 0);
    assert_eq!(get_chain_config(&conn_b).unwrap().seed_b64, cfg_c.seed_b64);

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_c.parent().unwrap());
}

#[test]
fn test_unlinked_device_with_business_data_requires_force_reset() {
    let path_a = temp_db("biz_a");
    let path_b = temp_db("biz_b");
    let conn_a = init_db(&path_a).unwrap();
    let mut conn_b = init_db(&path_b).unwrap();

    assert!(!get_chain_config(&conn_b).unwrap().is_linked);
    assert!(!has_local_business_data(&conn_b).unwrap());

    let bill = create_bill(
        &mut conn_b,
        IssueBillInput {
            items: vec![IssueBillItemInput { sku: "SKU-101".into(), qty: 1, warranty_label: None }],
            discount_minor: 0,
            payment_mode: "CASH".into(),
            customer_id: None,
            client_label: None,
            cashier_label: None,
        },
    )
    .unwrap();
    assert!(has_local_business_data(&conn_b).unwrap());

    let cfg_a = get_chain_config(&conn_a).unwrap();
    let uri_a = build_pairing_uri(&[0u8; 16], &cfg_a.seed_b64, "CASHIER", "K3", &cfg_a.shop_name, "");

    // (1) Unlinked device with an issued bill must reject join without force_reset and preserve bill
    let err = apply_join_chain_db(&mut conn_b, &uri_a, None, false).unwrap_err();
    assert!(err.contains("CONFIRM_RESET"), "Expected CONFIRM_RESET, got: {err}");
    let bill_count: i64 = conn_b
        .query_row("SELECT COUNT(*) FROM bills WHERE bill_no = ?1", [&bill.bill_no], |r| r.get(0))
        .unwrap();
    assert_eq!(bill_count, 1, "Issued bill must still exist after rejected join");
    assert!(!get_chain_config(&conn_b).unwrap().is_linked);

    // (2) With force_reset = true, the device gets wiped and joined
    apply_join_chain_db(&mut conn_b, &uri_a, None, true).unwrap();
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 0);
    let bill_count_after: i64 = conn_b.query_row("SELECT COUNT(*) FROM bills", [], |r| r.get(0)).unwrap();
    assert_eq!(bill_count_after, 0);
    let cfg_b = get_chain_config(&conn_b).unwrap();
    assert!(cfg_b.is_linked);
    assert_eq!(cfg_b.seed_b64, cfg_a.seed_b64);

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
}

#[test]
fn test_has_local_business_data_detects_extra_events_and_ledger_tables() {
    let path = temp_db("extra_events");
    let conn = init_db(&path).unwrap();
    assert!(!has_local_business_data(&conn).unwrap());

    // An extra ledger event (> STARTER_EVENT_COUNT) triggers business-data protection even with 0 bills
    conn.execute(
        "INSERT INTO ledger_events (event_id, hlc, node_id, event_type, payload_json)
         VALUES ('ev-extra', '2026-11-25T10:00:00.000Z-0001-K1', 'K1', 'STOCK_ADJUST', '{\"sku\":\"SKU-101\",\"delta\":1,\"reason\":\"x\"}')",
        [],
    ).unwrap();
    assert!(has_local_business_data(&conn).unwrap());

    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
