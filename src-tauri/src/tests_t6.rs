use std::path::PathBuf;

use rusqlite::Connection;

use crate::cmd_billing::create_bill;
use crate::cmd_sync_print::apply_join_chain_db;
use crate::crypto_chain::{build_pairing_uri, generate_node_id};
use crate::ledger::apply_ledger_event;
use crate::ledger_init::init_db;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::models::{IssueBillInput, IssueBillItemInput, LedgerEvent};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_t6_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

fn is_random_node(id: &str) -> bool {
    id.len() == 5
        && id.starts_with('K')
        && id[1..].chars().all(|c| c.is_ascii_uppercase() || ('2'..='7').contains(&c))
}

fn apply_all(conn: &mut Connection, events: &[LedgerEvent]) {
    let tx = conn.transaction().unwrap();
    for ev in events {
        apply_ledger_event(&tx, ev).unwrap();
    }
    tx.commit().unwrap();
}

fn sell(conn: &mut Connection, qty: i64) -> String {
    let input = IssueBillInput {
        items: vec![IssueBillItemInput { sku: "SKU-101".into(), qty, warranty_label: None }],
        discount_minor: 0,
        payment_mode: "CASH".into(),
        customer_id: None,
        client_label: None,
        cashier_label: None,
    };
    create_bill(conn, input).unwrap().bill_no
}

fn stock(conn: &Connection) -> i64 {
    conn.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap()
}

#[test]
fn test_generate_node_id_format_and_variety() {
    let ids: std::collections::HashSet<String> = (0..50).map(|_| generate_node_id()).collect();
    assert!(ids.iter().all(|id| is_random_node(id)), "bad ids: {ids:?}");
    assert!(ids.len() > 45, "50 draws from 2^20 should be near-unique, got {}", ids.len());
}

#[test]
fn test_two_cashiers_from_same_uri_get_distinct_ids_and_both_bills_survive() {
    let (pa, pb, pc) = (temp_db("a"), temp_db("b"), temp_db("c"));
    let conn_a = init_db(&pa).unwrap();
    let mut conn_b = init_db(&pb).unwrap();
    let mut conn_c = init_db(&pc).unwrap();

    let cfg_a = get_chain_config(&conn_a).unwrap();
    assert!(is_random_node(&cfg_a.node_id), "fresh install must not be K1: {}", cfg_a.node_id);
    let uri = build_pairing_uri(&[0u8; 16], &cfg_a.seed_b64, "CASHIER", "K3", &cfg_a.shop_name, "");

    apply_join_chain_db(&mut conn_b, &uri, None, false).unwrap();
    apply_join_chain_db(&mut conn_c, &uri, None, false).unwrap();
    let node_b = get_chain_config(&conn_b).unwrap().node_id;
    let node_c = get_chain_config(&conn_c).unwrap().node_id;
    assert_ne!(node_b, "K3", "URI node param must be ignored");
    assert_ne!(node_b, node_c, "two joins with the same URI must get different node IDs");

    let events_a = all_ledger_events(&conn_a).unwrap();
    apply_all(&mut conn_b, &events_a);
    apply_all(&mut conn_c, &events_a);
    assert_eq!(stock(&conn_b), 24);

    // Both cashiers sell offline on the same day, then merge.
    let bill_b = sell(&mut conn_b, 1);
    let bill_c = sell(&mut conn_c, 2);
    assert_ne!(bill_b, bill_c);
    let events_c = all_ledger_events(&conn_c).unwrap();
    apply_all(&mut conn_b, &events_c);

    let bills: i64 = conn_b.query_row("SELECT COUNT(*) FROM bills", [], |r| r.get(0)).unwrap();
    assert_eq!(bills, 2, "both bills must survive the merge");
    assert_eq!(stock(&conn_b), 21, "both sales must deduct stock (24 - 1 - 2)");

    for p in [pa, pb, pc] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_legacy_shared_node_id_migrates_on_open() {
    let path = temp_db("legacy");
    let conn = init_db(&path).unwrap();
    conn.execute("UPDATE chain_config SET node_id = 'K3', is_linked = 1 WHERE id = 1", []).unwrap();
    drop(conn);
    let conn = init_db(&path).unwrap();
    let node = get_chain_config(&conn).unwrap().node_id;
    assert!(is_random_node(&node), "legacy K3 must become a unique ID, got {node}");
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
