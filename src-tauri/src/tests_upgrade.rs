use std::path::PathBuf;

use rusqlite::Connection;
use serde_json::json;

use crate::chain_upgrade::secure_chain_db;
use crate::cmd_billing::create_bill;
use crate::cmd_sync_print::apply_join_chain_db;
use crate::crypto_chain::{build_pairing_uri, decode_seed_b64, derive_chain_id_hash};
use crate::hlc::new_event_id;
use crate::ledger::apply_ledger_event;
use crate::ledger_init::init_db;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::models::{IssueBillInput, IssueBillItemInput, LedgerEvent};
use crate::owner_sig::verify_event;
use crate::pairing::{upgrade_proof, with_owner_params, with_upgrade_from};
use crate::tests_s4::init_unsecured_db;

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_up_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

/// The invite `build_sync_status` would show on `owner` for `role`.
fn invite(owner: &Connection, role: &str) -> String {
    let c = get_chain_config(owner).unwrap();
    let uri = build_pairing_uri(&decode_seed_b64(&c.seed_b64).unwrap(), &c.seed_b64, role, "K3", &c.shop_name, "");
    with_upgrade_from(with_owner_params(uri, role, &c.owner_pk, &c.owner_secret), &c.prev_seed_b64, &c.seed_b64)
}

fn put(conn: &mut Connection, evs: &[LedgerEvent]) {
    let tx = conn.transaction().unwrap();
    for e in evs {
        apply_ledger_event(&tx, e).unwrap();
    }
    tx.commit().unwrap();
}

fn price(conn: &Connection) -> i64 {
    conn.query_row("SELECT sell_price_minor FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap()
}

fn sell_one(conn: &mut Connection) -> String {
    let item = IssueBillItemInput { sku: "SKU-101".into(), qty: 1, warranty_label: None };
    let input = IssueBillInput { items: vec![item], discount_minor: 0, payment_mode: "CASH".into(), customer_id: None, client_label: None, cashier_label: None };
    create_bill(conn, input).unwrap().bill_no
}

#[test]
fn test_legacy_shop_upgrades_keeping_sales_and_dropping_forgeries() {
    let (pa, pc) = (temp_db("a"), temp_db("c"));
    let mut a = init_unsecured_db(&pa).unwrap();
    let mut c = init_unsecured_db(&pc).unwrap();
    apply_join_chain_db(&mut c, &invite(&a, "CASHIER"), None, false).unwrap();
    put(&mut c, &all_ledger_events(&a).unwrap());
    let real_price = price(&a);

    // On the open chain a cashier forges a price edit; the legacy device accepts it.
    let hlc = "2031-01-01T00:00:00.000Z-0001-KCASH".to_string();
    let forged = LedgerEvent { event_id: new_event_id(&hlc), hlc, node_id: "KCASH".into(), event_type: "PRODUCT_UPSERT".into(),
        payload_json: json!({"sku": "SKU-101", "name": "Cold Brew", "barcode": null, "category": "Beverages",
            "sell_price_minor": 1, "cost_price_minor": 1, "low_stock_threshold": 1}).to_string(),
        synced_lan: 0, synced_relay: 0, sig: String::new() };
    put(&mut c, &[forged.clone()]);
    assert_eq!(price(&c), 1);

    let old_hash = derive_chain_id_hash(&decode_seed_b64(&get_chain_config(&a).unwrap().seed_b64).unwrap());
    assert_eq!(secure_chain_db(&mut a).unwrap(), 5, "the 5 starter catalog edits get signed");
    let a_cfg = get_chain_config(&a).unwrap();
    assert!(all_ledger_events(&a).unwrap().iter().filter(|e| e.event_type == "PRODUCT_UPSERT").all(|e| verify_event(&a_cfg.owner_pk, e)));
    assert_ne!(derive_chain_id_hash(&decode_seed_b64(&a_cfg.seed_b64).unwrap()), old_hash, "secured chain has a new key");
    assert!(secure_chain_db(&mut a).is_err(), "cannot secure twice");

    // The cashier keeps selling on the old chain, then scans the new QR: no wipe prompt.
    let bill = sell_one(&mut c);
    apply_join_chain_db(&mut c, &invite(&a, "CASHIER"), None, false).unwrap();
    let c_cfg = get_chain_config(&c).unwrap();
    assert_eq!((c_cfg.seed_b64.as_str(), c_cfg.owner_pk.as_str(), c_cfg.role.as_str()), (a_cfg.seed_b64.as_str(), a_cfg.owner_pk.as_str(), "CASHIER"));
    let has = |conn: &Connection, id: &str| -> bool { conn.query_row("SELECT EXISTS(SELECT 1 FROM ledger_events WHERE event_id = ?1)", [id], |r| r.get(0)).unwrap() };
    assert!(!has(&c, &forged.event_id), "forged owner edit is dropped on upgrade");
    let bills: i64 = c.query_row("SELECT COUNT(*) FROM bills WHERE bill_no = ?1", [&bill], |r| r.get(0)).unwrap();
    assert_eq!(bills, 1, "sales made before re-pairing are kept");

    // First sync: C gets A's signed catalog back; A gets C's bill.
    put(&mut c, &all_ledger_events(&a).unwrap());
    put(&mut a, &all_ledger_events(&c).unwrap());
    assert_eq!((price(&c), price(&a)), (real_price, real_price));
    let stock = |conn: &Connection| -> i64 { conn.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap() };
    assert_eq!(stock(&a), stock(&c));
    drop((a, c));
    for p in [pa, pc] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_stranger_cannot_fake_an_upgrade_to_skip_the_wipe() {
    let (pv, ps) = (temp_db("victim"), temp_db("stranger"));
    let mut victim = init_unsecured_db(&pv).unwrap();
    let stranger = init_db(&ps).unwrap();
    sell_one(&mut victim);
    let v_cfg = get_chain_config(&victim).unwrap();
    let public_id = derive_chain_id_hash(&decode_seed_b64(&v_cfg.seed_b64).unwrap());
    let s_cfg = get_chain_config(&stranger).unwrap();
    let base = invite(&stranger, "CASHIER");
    let wrong_key_proof = upgrade_proof(&[9u8; 16], &s_cfg.seed_b64);
    for fake in [format!("{base}&from={public_id}"), format!("{base}&from={wrong_key_proof}")] {
        let err = apply_join_chain_db(&mut victim, &fake, None, false).unwrap_err();
        assert!(err.contains("CONFIRM_RESET"), "fake upgrade must fall back to the wipe prompt: {err}");
    }
    assert_eq!(get_chain_config(&victim).unwrap().seed_b64, v_cfg.seed_b64);
    drop((victim, stranger));
    for p in [pv, ps] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_only_owner_can_secure() {
    let (pa, pc) = (temp_db("o"), temp_db("k"));
    let a = init_unsecured_db(&pa).unwrap();
    let mut c = init_unsecured_db(&pc).unwrap();
    apply_join_chain_db(&mut c, &invite(&a, "CASHIER"), None, false).unwrap();
    assert!(secure_chain_db(&mut c).is_err());
    drop((a, c));
    for p in [pa, pc] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}
