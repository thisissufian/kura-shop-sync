use std::path::PathBuf;

use k256::schnorr::SigningKey;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::cmd_sync_print::apply_join_chain_db;
use crate::crypto_chain::{build_pairing_uri, decode_seed_b64};
use crate::hlc::current_epoch_ms;
use crate::ledger_init::init_db;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::owner_sig::{apply_local_event, hex};
use crate::pairing::with_owner_params;
use crate::relay_nostr::{ingest_nostr_event, mark_relay_published, pending_relay_batch, sign_nostr_event, verify_nostr_event};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_s5_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

#[test]
fn test_bip340_vector_0_matches_relay_signature_scheme() {
    // BIP340 test vector 0 (secret key 3, aux and message all zero).
    let mut sk = [0u8; 32];
    sk[31] = 3;
    let sk = SigningKey::from_bytes(&sk).unwrap();
    assert_eq!(hex(&sk.verifying_key().to_bytes()).to_uppercase(), "F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9");
    let sig = sk.sign_raw(&[0u8; 32], &[0u8; 32]).unwrap();
    assert_eq!(
        hex(&sig.to_bytes()).to_uppercase(),
        "E907831F80848D1069A5371B402410364BDF1C5F8307B0084C55F1CE2DCA821525F66A4A85EA8B71E482A74F382D2CE5EBEEE8FDB2172F477DF4900D310536C0"
    );
}

#[test]
fn test_event_id_is_nip01_canonical_and_tampering_fails() {
    let sk = SigningKey::from_bytes(&[7u8; 32]).unwrap();
    let ev = sign_nostr_event(&sk, 1_700_000_000, json!([["d", "kura:x"], ["t", "abc"]]), "Y29udGVudA==".into()).unwrap();
    let pk = ev["pubkey"].as_str().unwrap();
    let canonical = format!("[0,\"{pk}\",1700000000,30078,[[\"d\",\"kura:x\"],[\"t\",\"abc\"]],\"Y29udGVudA==\"]");
    assert_eq!(ev["id"].as_str().unwrap(), hex(&Sha256::digest(canonical.as_bytes())));
    assert!(verify_nostr_event(&ev));
    let mut bad = ev.clone();
    bad["content"] = json!("dGFtcGVyZWQ=");
    assert!(!verify_nostr_event(&bad));
}

#[test]
fn test_relay_round_trip_and_only_changed_chunks_republish() {
    let (pa, pb, pc) = (temp_db("a"), temp_db("b"), temp_db("c"));
    let mut a = init_db(&pa).unwrap();
    let mut b = init_db(&pb).unwrap();
    let mut stranger = init_db(&pc).unwrap();
    let cfg = get_chain_config(&a).unwrap();
    let uri = build_pairing_uri(&decode_seed_b64(&cfg.seed_b64).unwrap(), &cfg.seed_b64, "CASHIER", "K3", &cfg.shop_name, "");
    apply_join_chain_db(&mut b, &with_owner_params(uri, "CASHIER", &cfg.owner_pk, ""), None, false).unwrap();

    let now = current_epoch_ms();
    let batch = pending_relay_batch(&a, now).unwrap();
    assert!(!batch.events.is_empty());
    let mut landed = 0;
    for out in &batch.events {
        assert!(verify_nostr_event(&out.event), "every published event must be NIP-01 valid");
        assert_eq!(ingest_nostr_event(&mut stranger, &out.event).unwrap(), 0, "other chains ignore it");
        landed += ingest_nostr_event(&mut b, &out.event).unwrap();
        mark_relay_published(&a, &out.d, &out.digest).unwrap();
    }
    assert_eq!(landed, all_ledger_events(&a).unwrap().len(), "B receives all of A's events via the relay");
    assert!(pending_relay_batch(&a, now).unwrap().events.is_empty(), "confirmed chunks are not republished");

    let tx = a.transaction().unwrap();
    let hlc = crate::hlc::next_hlc(&tx, &cfg.node_id).unwrap();
    let ev = crate::models::LedgerEvent {
        event_id: crate::hlc::new_event_id(&hlc), hlc, node_id: cfg.node_id.clone(), event_type: "STOCK_ADJUST".into(),
        payload_json: json!({"sku": "SKU-101", "delta": 2, "reason": "count"}).to_string(), synced_lan: 0, synced_relay: 0, sig: String::new(),
    };
    apply_local_event(&tx, &ev).unwrap();
    tx.commit().unwrap();
    let again = pending_relay_batch(&a, now).unwrap().events;
    assert_eq!(again.len(), 1, "one new event changes exactly one chunk");
    assert_eq!(ingest_nostr_event(&mut b, &again[0].event).unwrap(), 1);

    let far_future = now + 400 * 86_400_000;
    assert!(pending_relay_batch(&a, far_future).unwrap().events.is_empty(), "buckets older than the window are not published");
    drop((a, b, stranger));
    for p in [pa, pb, pc] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}
