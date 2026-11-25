use std::path::PathBuf;

use rusqlite::Connection;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::cmd_sync_print::apply_join_chain_db;
use crate::crypto_chain::{build_pairing_uri, decode_seed_b64, generate_seed};
use crate::hlc::new_event_id;
use crate::ledger::apply_ledger_event;
use crate::ledger_init::init_db;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::mnemonic::{owner_phrase, phrase_to_secrets, seed_to_phrase, PREFIXES, SUFFIXES};
use crate::models::LedgerEvent;
use crate::owner_sig::{apply_local_event, decode_secret, generate_owner_secret, sign_event, verify_event};
use crate::pairing::with_owner_params;

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_s4_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

fn invite(owner: &Connection, role: &str) -> String {
    let cfg = get_chain_config(owner).unwrap();
    let seed = decode_seed_b64(&cfg.seed_b64).unwrap();
    let uri = build_pairing_uri(&seed, &cfg.seed_b64, role, "K3", &cfg.shop_name, "");
    with_owner_params(uri, role, &cfg.owner_pk, &cfg.owner_secret)
}

fn price_edit(node: &str, price: i64) -> LedgerEvent {
    let hlc = format!("2030-01-01T00:00:00.000Z-0001-{node}");
    LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: node.into(),
        event_type: "PRODUCT_UPSERT".into(),
        payload_json: json!({"sku": "SKU-101", "name": "Cold Brew", "barcode": null, "category": "Beverages",
            "sell_price_minor": price, "cost_price_minor": 1, "low_stock_threshold": 1}).to_string(),
        synced_lan: 0,
        synced_relay: 0,
        sig: String::new(),
    }
}

fn apply(conn: &mut Connection, ev: &LedgerEvent) -> bool {
    let tx = conn.transaction().unwrap();
    let ok = apply_ledger_event(&tx, ev).unwrap();
    tx.commit().unwrap();
    ok
}

fn price(conn: &Connection) -> i64 {
    conn.query_row("SELECT sell_price_minor FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap()
}

#[test]
fn test_fresh_chain_is_secured_and_signs_its_owner_events() {
    let path = temp_db("fresh");
    let conn = init_db(&path).unwrap();
    let cfg = get_chain_config(&conn).unwrap();
    assert_eq!(cfg.owner_pk.len(), 64);
    let upserts: Vec<_> = all_ledger_events(&conn).unwrap().into_iter().filter(|e| e.event_type == "PRODUCT_UPSERT").collect();
    assert_eq!(upserts.len(), 5);
    assert!(upserts.iter().all(|e| verify_event(&cfg.owner_pk, e)), "starter catalog must be owner-signed");
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

#[test]
fn test_cashier_cannot_forge_owner_events_or_escalate() {
    let (pa, pc) = (temp_db("owner"), temp_db("cashier"));
    let mut owner = init_db(&pa).unwrap();
    let mut cashier = init_db(&pc).unwrap();
    let cashier_uri = invite(&owner, "CASHIER");
    assert!(!cashier_uri.contains("osec="), "cashier invite must not carry the owner secret");

    // Escalation by editing the invite: role=OWNER without the secret, or with a made-up one.
    let edited = cashier_uri.replace("role=CASHIER", "role=OWNER");
    assert!(apply_join_chain_db(&mut cashier, &edited, None, false).is_err());
    let fake = format!("{edited}&osec={}", crate::owner_sig::encode_secret(&generate_owner_secret()));
    assert!(apply_join_chain_db(&mut cashier, &fake, None, false).is_err());

    apply_join_chain_db(&mut cashier, &cashier_uri, None, false).unwrap();
    let c_cfg = get_chain_config(&cashier).unwrap();
    assert_eq!((c_cfg.role.as_str(), c_cfg.owner_secret.as_str()), ("CASHIER", ""));
    assert_eq!(c_cfg.owner_pk, get_chain_config(&owner).unwrap().owner_pk);

    // The cashier device refuses to create owner events...
    let tx = cashier.transaction().unwrap();
    assert!(apply_local_event(&tx, &price_edit("KCASH", 1)).is_err());
    drop(tx);
    // ...and a hand-crafted one (unsigned, or signed with its own key) is rejected by the owner.
    let before = price(&owner);
    let mut forged = price_edit("KCASH", 1);
    assert!(!apply(&mut owner, &forged));
    forged.event_id.push('x');
    forged.sig = sign_event(&generate_owner_secret(), &forged).unwrap();
    assert!(!apply(&mut owner, &forged));
    assert_eq!(price(&owner), before);
    // A held signed event echoed back without `sig` (older app) is a no-op, not a rejection.
    let mut echoed = all_ledger_events(&owner).unwrap().into_iter().find(|e| e.event_type == "PRODUCT_UPSERT").unwrap();
    echoed.sig.clear();
    assert!(!apply(&mut owner, &echoed));
    let rejected: i64 = owner.query_row("SELECT COUNT(*) FROM rejected_events", [], |r| r.get(0)).unwrap();
    assert_eq!(rejected, 2, "only the two forgeries are remembered, so sync stops re-offering them");
    drop((owner, cashier));
    for p in [pa, pc] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_second_owner_and_phrase_recovery_can_sign() {
    let (pa, pb, pd) = (temp_db("a"), temp_db("b"), temp_db("d"));
    let mut a = init_db(&pa).unwrap();
    let mut b = init_db(&pb).unwrap();
    let mut d = init_db(&pd).unwrap();
    apply_join_chain_db(&mut b, &invite(&a, "OWNER"), None, false).unwrap();

    let a_cfg = get_chain_config(&a).unwrap();
    let phrase = owner_phrase(&decode_seed_b64(&a_cfg.seed_b64).unwrap(), &decode_secret(&a_cfg.owner_secret).unwrap());
    assert_eq!(phrase.split_whitespace().count(), 24);
    apply_join_chain_db(&mut d, &phrase, None, false).unwrap();
    assert_eq!(get_chain_config(&d).unwrap().owner_pk, a_cfg.owner_pk, "24-word phrase restores the owner key");

    for (dev, node, p) in [(&mut b, "KBOWN", 777), (&mut d, "KDOWN", 888)] {
        let ev = price_edit(node, p);
        let tx = dev.transaction().unwrap();
        apply_local_event(&tx, &ev).unwrap();
        tx.commit().unwrap();
        let signed = all_ledger_events(dev).unwrap().into_iter().find(|e| e.event_id == ev.event_id).unwrap();
        assert!(apply(&mut a, &signed), "owner A must accept a signed edit from {node}");
        assert_eq!(price(&a), p);
    }
    drop((a, b, d));
    for p in [pa, pb, pd] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_legacy_unsecured_chain_still_accepts_unsigned_owner_events() {
    let path = temp_db("legacy");
    let mut conn = init_db(&path).unwrap();
    conn.execute("UPDATE chain_config SET owner_secret = '', owner_pk = ''", []).unwrap();
    assert!(apply(&mut conn, &price_edit("KOLD1", 4242)));
    assert_eq!(price(&conn), 4242);
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

/// Copy of the pre-S4 encoder: existing 12-word phrases written down by owners must not change.
fn old_seed_to_phrase(seed: &[u8; 16]) -> String {
    let csum = (Sha256::digest(seed)[0] >> 4) & 0x0F;
    let bits = u128::from_be_bytes(*seed);
    let mut all: Vec<u8> = (0..128).rev().map(|i| ((bits >> i) & 1) as u8).collect();
    all.extend((0..4).rev().map(|i| (csum >> i) & 1));
    all.chunks(11)
        .map(|c| {
            let idx = c.iter().fold(0usize, |a, &b| (a << 1) | b as usize);
            format!("{}{}", PREFIXES[idx / 32], SUFFIXES[idx % 32])
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn test_phrases_stay_compatible_and_round_trip() {
    for _ in 0..200 {
        let (seed, owner) = (generate_seed(), generate_owner_secret());
        assert_eq!(seed_to_phrase(&seed), old_seed_to_phrase(&seed));
        assert_eq!(phrase_to_secrets(&seed_to_phrase(&seed)).unwrap(), (seed, None));
        assert_eq!(phrase_to_secrets(&owner_phrase(&seed, &owner)).unwrap(), (seed, Some(owner)));
    }
    let mut words: Vec<String> = owner_phrase(&[7; 16], &[9; 16]).split(' ').map(String::from).collect();
    words.swap(3, 4);
    assert!(phrase_to_secrets(&words.join(" ")).is_err(), "24-word checksum must catch swapped words");
}

/// A pre-S4 (unsecured) chain. Projection tests that inject hand-made owner
/// events from simulated remote devices use this instead of a secured fresh install.
pub(crate) fn init_unsecured_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = init_db(path)?;
    conn.execute("UPDATE chain_config SET owner_secret = '', owner_pk = ''", []).map_err(|e| e.to_string())?;
    Ok(conn)
}
