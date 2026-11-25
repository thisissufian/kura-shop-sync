use std::path::PathBuf;

use crate::cmd_sync_print::apply_join_chain_db;
use crate::crypto_chain::build_pairing_uri;
use crate::ledger::apply_ledger_event;
use crate::ledger_init::init_db;
use crate::ledger_queries::{all_ledger_events, get_chain_config};

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
    assert_eq!(events_a.len(), 10, "Fresh DB A should have 10 starter events");
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 10, "Fresh DB B starts with 10 starter events");

    let cfg_a = get_chain_config(&conn_a).unwrap();
    let uri_a = build_pairing_uri(&[0u8; 16], &cfg_a.seed_b64, "CASHIER", "K3", &cfg_a.shop_name, "");

    // Add local bill, customer, supplier, expense rows on B to verify all 6 tables reset
    conn_b.execute("INSERT INTO bills (bill_no, node_id, hlc, items_json, discount_minor, total_minor, payment_mode) VALUES ('K1-1', 'K1', '2026-11-25T00:00:00.000Z-0001-K1', '[]', 0, 100, 'CASH')", []).unwrap();
    conn_b.execute("INSERT INTO customers (customer_id, name, phone, balance_due_minor, updated_hlc) VALUES ('C1', 'Test', '017', 50, '2026-11-25T00:00:00.000Z-0001-K1')", []).unwrap();
    conn_b.execute("INSERT INTO suppliers (supplier_id, name, phone, payable_balance_minor, updated_hlc) VALUES ('S1', 'Supp', '018', 25, '2026-11-25T00:00:00.000Z-0001-K1')", []).unwrap();
    conn_b.execute("INSERT INTO expenses (expense_id, category, amount_minor, note, node_id, hlc) VALUES ('E1', 'Misc', 10, 'n', 'K1', '2026-11-25T00:00:00.000Z-0001-K1')", []).unwrap();

    // Invalid URI must fail without deleting any local data
    assert!(apply_join_chain_db(&mut conn_b, "invalid-uri", None, false).is_err());
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 10);

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

    // Joining another chain without force_reset must error and preserve existing linked data
    let err = apply_join_chain_db(&mut conn_b, &uri_c, None, false).unwrap_err();
    assert!(err.contains("CONFIRM_RESET"), "Expected reset confirmation error, got: {err}");
    assert_eq!(get_chain_config(&conn_b).unwrap().seed_b64, cfg_a.seed_b64);
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), events_a.len());

    // Confirming reset wipes old chain data and switches seed
    apply_join_chain_db(&mut conn_b, &uri_c, None, true).unwrap();
    assert_eq!(all_ledger_events(&conn_b).unwrap().len(), 0);
    assert_eq!(get_chain_config(&conn_b).unwrap().seed_b64, cfg_c.seed_b64);

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_c.parent().unwrap());
}
