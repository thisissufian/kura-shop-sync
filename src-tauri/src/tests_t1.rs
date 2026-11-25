use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::params;
use std::path::PathBuf;

use crate::cmd_config_vault::{build_encrypted_vault, restore_encrypted_vault};
use crate::crypto_chain::{decode_seed_b64, encrypt_bytes};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_init::init_db;
use crate::ledger_queries::get_chain_config;
use crate::mnemonic::seed_to_phrase;
use crate::models::LedgerEvent;

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_t1_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

#[test]
fn test_vault_restore_wrong_phrase_preserves_seed_and_config() {
    let path_a = temp_db("owner_a");
    let path_b = temp_db("target_b");
    let conn_a = init_db(&path_a).unwrap();
    let mut conn_b = init_db(&path_b).unwrap();

    conn_b
        .execute(
            "UPDATE chain_config SET role = 'CASHIER', is_linked = 0, shop_name = 'Target Shop' WHERE id = 1",
            [],
        )
        .unwrap();
    let before = get_chain_config(&conn_b).unwrap();

    let (payload_b64, _) = build_encrypted_vault(&conn_a).unwrap();
    let wrong_seed = [0x5Au8; 16];
    let wrong_phrase = seed_to_phrase(&wrong_seed);
    assert_ne!(decode_seed_b64(&before.seed_b64).unwrap(), wrong_seed);

    let res = restore_encrypted_vault(&mut conn_b, &payload_b64, Some(&wrong_phrase));
    assert!(res.is_err(), "Wrong recovery phrase must fail decryption");

    let after = get_chain_config(&conn_b).unwrap();
    assert_eq!(after.seed_b64, before.seed_b64, "seed_b64 must remain unchanged on failure");
    assert_eq!(after.role, before.role, "role must remain unchanged on failure");
    assert_eq!(after.is_linked, before.is_linked, "is_linked must remain unchanged on failure");
    assert_eq!(after.shop_name, before.shop_name, "shop_name must remain unchanged on failure");

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
}

#[test]
fn test_vault_restore_invalid_payload_or_event_is_atomic() {
    let path_b = temp_db("atomic_b");
    let mut conn_b = init_db(&path_b).unwrap();
    conn_b
        .execute(
            "UPDATE chain_config SET role = 'CASHIER', is_linked = 0, shop_name = 'Original' WHERE id = 1",
            [],
        )
        .unwrap();
    let before = get_chain_config(&conn_b).unwrap();
    let other_seed = [0x33u8; 16];
    let other_phrase = seed_to_phrase(&other_seed);

    // 1. Corrupt base64
    assert!(restore_encrypted_vault(&mut conn_b, "!!!not-base64!!!", Some(&other_phrase)).is_err());
    // 2. Decrypts cleanly but is not valid VaultSnapshot JSON
    let bad_json_b64 = STANDARD.encode(encrypt_bytes(&other_seed, b"{bad json").unwrap());
    assert!(restore_encrypted_vault(&mut conn_b, &bad_json_b64, Some(&other_phrase)).is_err());
    // 3. Valid VaultSnapshot JSON whose ledger event fails mid-apply -> whole tx rolls back
    let bad_ev_snapshot = serde_json::json!({
        "version": 1,
        "shop_name": "Hijacked Shop",
        "shop_subtitle": "Sub",
        "currency_symbol": "B",
        "receipt_footer": "Bye",
        "events": [{
            "event_id": "ev-bad-1",
            "hlc": "2026-11-25T10:00:00.000Z-0001-K9",
            "node_id": "K9",
            "event_type": "BILL_ISSUED",
            "payload_json": "not-valid-bill-json",
            "synced_lan": 0,
            "synced_relay": 0
        }]
    });
    let bad_ev_b64 = STANDARD.encode(
        encrypt_bytes(&other_seed, serde_json::to_vec(&bad_ev_snapshot).unwrap().as_slice()).unwrap(),
    );
    assert!(restore_encrypted_vault(&mut conn_b, &bad_ev_b64, Some(&other_phrase)).is_err());

    let after = get_chain_config(&conn_b).unwrap();
    assert_eq!(after.seed_b64, before.seed_b64);
    assert_eq!(after.role, before.role);
    assert_eq!(after.is_linked, before.is_linked);
    assert_eq!(after.shop_name, before.shop_name);
    let bad_ev_count: i64 = conn_b
        .query_row("SELECT COUNT(*) FROM ledger_events WHERE event_id = 'ev-bad-1'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(bad_ev_count, 0);

    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
}

#[test]
fn test_vault_restore_valid_phrase_roundtrip_and_without_phrase() {
    let path_a = temp_db("roundtrip_a");
    let path_b = temp_db("roundtrip_b");
    let mut conn_a = init_db(&path_a).unwrap();
    let mut conn_b = init_db(&path_b).unwrap();

    conn_a
        .execute(
            "UPDATE chain_config SET shop_name = 'Alpha Mart', shop_subtitle = 'Dhaka', currency_symbol = '৳', receipt_footer = 'Come back!' WHERE id = 1",
            [],
        )
        .unwrap();
    {
        let tx = conn_a.transaction().unwrap();
        let prod = ProductUpsertPayload {
            sku: "SKU-T1-UNIQUE".into(),
            name: "Vault Restored Tea".into(),
            barcode: None,
            category: "Beverages".into(),
            brand: "Kura".into(),
            variant: "500g".into(),
            warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
            sell_price_minor: 4500,
            cost_price_minor: 2500,
            low_stock_threshold: 3,
        };
        apply_ledger_event(&tx, &LedgerEvent {
            event_id: "ev-t1-p".into(),
            hlc: "2099-02-01T00:00:00.000Z-0001-K1".into(),
            node_id: "K1".into(),
            event_type: "PRODUCT_UPSERT".into(),
            payload_json: serde_json::to_string(&prod).unwrap(),
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        }).unwrap();
        apply_ledger_event(&tx, &LedgerEvent {
            event_id: "ev-t1-s".into(),
            hlc: "2099-02-01T00:00:00.000Z-0002-K1".into(),
            node_id: "K1".into(),
            event_type: "STOCK_ADJUST".into(),
            payload_json: serde_json::to_string(&StockAdjustPayload {
                sku: "SKU-T1-UNIQUE".into(), delta: 7, reason: "Vault test".into(),
            }).unwrap(),
            synced_lan: 0,
            synced_relay: 0,
            sig: String::new(),
        }).unwrap();
        tx.commit().unwrap();
    }

    let cfg_a = get_chain_config(&conn_a).unwrap();
    let phrase_a = seed_to_phrase(&decode_seed_b64(&cfg_a.seed_b64).unwrap());
    let (payload_b64, expected_events) = build_encrypted_vault(&conn_a).unwrap();

    conn_b
        .execute("UPDATE chain_config SET role = 'CASHIER', is_linked = 0 WHERE id = 1", params![])
        .unwrap();

    let applied = restore_encrypted_vault(&mut conn_b, &payload_b64, Some(&phrase_a)).unwrap();
    assert_eq!(applied, expected_events);

    let cfg_b = get_chain_config(&conn_b).unwrap();
    assert_eq!(cfg_b.seed_b64, cfg_a.seed_b64);
    assert_eq!(cfg_b.role, "OWNER");
    assert!(cfg_b.is_linked);
    assert_eq!(cfg_b.shop_name, "Alpha Mart");
    assert_eq!(cfg_b.shop_subtitle, "Dhaka");
    assert_eq!(cfg_b.currency_symbol, "৳");
    assert_eq!(cfg_b.receipt_footer, "Come back!");
    assert!(cfg_b.last_hlc.as_str() > "2099-02-01T00:00:00.000Z-0002-K1");

    let qty: i64 = conn_b
        .query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-T1-UNIQUE'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(qty, 7);

    // Same-device restore without recovery phrase uses existing seed_b64
    let reapplied = restore_encrypted_vault(&mut conn_b, &payload_b64, None).unwrap();
    assert_eq!(reapplied, 0);

    let _ = std::fs::remove_dir_all(path_a.parent().unwrap());
    let _ = std::fs::remove_dir_all(path_b.parent().unwrap());
}
