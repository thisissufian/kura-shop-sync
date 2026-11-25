//! Remote sync over public Nostr relays (S5). Relays only accept NIP-01 events
//! (id = sha256 of the canonical array, BIP340 signature) and never store the
//! ephemeral kinds (20000-29999) the old code used. We publish kind 30078
//! (NIP-78 app data, parameterized-replaceable). Each `d` tag is one chunk of an
//! S1 bucket: one origin node, one UTC day, up to PART_SIZE events. Contents are
//! AES-GCM encrypted with the chain key. A changed chunk replaces the stored one,
//! so a device that was offline can catch up by asking the relay.
use base64::{engine::general_purpose::STANDARD, Engine};
use hkdf::Hkdf;
use k256::schnorr::{Signature, SigningKey, VerifyingKey};
use rand::RngCore;
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::crypto_chain::{decode_seed_b64, decrypt_events, derive_chain_id_hash, encrypt_events};
use crate::hlc::{current_epoch_ms, local_civil_date, observe_remote_hlc};
use crate::ledger::apply_ledger_event;
use crate::ledger_queries::get_chain_config;
use crate::owner_sig::{hex, unhex};
use crate::sync_digest::{bucket_events, local_buckets};

pub const RELAY_KIND: u64 = 30078;
// Many public relays cap events near 64 KB; 15 events stays well under after AES + base64.
const PART_SIZE: usize = 15;
const WINDOW_DAYS: u128 = 30;
const MAX_PUBLISH: usize = 20;

#[derive(Debug, Serialize)]
pub struct RelayOutgoing {
    pub d: String,
    pub digest: String,
    pub event: Value,
}

#[derive(Debug, Serialize)]
pub struct RelayBatch {
    pub chain_tag: String,
    pub since: u64,
    pub events: Vec<RelayOutgoing>,
}

/// Per-device relay identity, derived so it needs no storage. It authorises
/// nothing: payloads are chain-encrypted and owner rights come from S4.
fn nostr_key(seed: &[u8; 16], node_id: &str) -> Result<SigningKey, String> {
    let hk = Hkdf::<Sha256>::new(Some(b"kura-nostr-v1"), seed);
    for counter in 0u8..=255 {
        let mut okm = [0u8; 32];
        hk.expand(&[node_id.as_bytes(), &[counter]].concat(), &mut okm).map_err(|_| "Relay key derivation failed".to_string())?;
        if let Ok(k) = SigningKey::from_bytes(&okm) {
            return Ok(k);
        }
    }
    Err("Relay key derivation failed".to_string())
}

/// NIP-01 event id: sha256 of `[0, pubkey, created_at, kind, tags, content]`, compact JSON.
fn event_id(pubkey: &str, created_at: u64, kind: u64, tags: &Value, content: &str) -> [u8; 32] {
    let canonical = json!([0, pubkey, created_at, kind, tags, content]).to_string();
    Sha256::digest(canonical.as_bytes()).into()
}

pub fn sign_nostr_event(sk: &SigningKey, created_at: u64, tags: Value, content: String) -> Result<Value, String> {
    let pubkey = hex(&sk.verifying_key().to_bytes());
    let id = event_id(&pubkey, created_at, RELAY_KIND, &tags, &content);
    let mut aux = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut aux);
    let sig = sk.sign_raw(&id, &aux).map_err(|_| "Relay signing failed".to_string())?;
    Ok(json!({"id": hex(&id), "pubkey": pubkey, "created_at": created_at, "kind": RELAY_KIND,
              "tags": tags, "content": content, "sig": hex(&sig.to_bytes())}))
}

pub fn verify_nostr_event(ev: &Value) -> bool {
    let (Some(pubkey), Some(created_at), Some(kind), Some(content), Some(id), Some(sig)) = (
        ev["pubkey"].as_str(), ev["created_at"].as_u64(), ev["kind"].as_u64(),
        ev["content"].as_str(), ev["id"].as_str(), ev["sig"].as_str(),
    ) else {
        return false;
    };
    let expected = event_id(pubkey, created_at, kind, &ev["tags"], content);
    let (Some(pk), Some(sig)) = (unhex(pubkey), unhex(sig)) else { return false };
    if hex(&expected) != id || pk.len() != 32 || sig.len() != 64 {
        return false;
    }
    match (VerifyingKey::from_bytes(&pk), Signature::try_from(sig.as_slice())) {
        (Ok(vk), Ok(sig)) => vk.verify_raw(&expected, &sig).is_ok(),
        _ => false,
    }
}

fn utc_day(epoch_ms: u128) -> String {
    let (y, m, d) = local_civil_date(epoch_ms, 0);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Chunks of recent buckets whose contents changed since their last confirmed publish.
pub fn pending_relay_batch(conn: &Connection, now_ms: u128) -> Result<RelayBatch, String> {
    let cfg = get_chain_config(conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let chain_tag = derive_chain_id_hash(&seed);
    let sk = nostr_key(&seed, &cfg.node_id)?;
    let since_ms = now_ms.saturating_sub(WINDOW_DAYS * 86_400_000);
    let cutoff = utc_day(since_ms);
    let mut events = Vec::new();
    'outer: for b in local_buckets(conn)?.into_iter().filter(|b| b.day >= cutoff) {
        for (i, part) in bucket_events(conn, &b.node, &b.day)?.chunks(PART_SIZE).enumerate() {
            let d = format!("kura:{chain_tag}:{}:{}:{i}", b.node, b.day);
            let ids: Vec<&str> = part.iter().map(|e| e.event_id.as_str()).collect();
            let digest = hex(&Sha256::digest(ids.join(",").as_bytes())[..8]);
            let done: Option<String> = conn
                .query_row("SELECT digest FROM relay_published WHERE d = ?1", params![d], |r| r.get(0))
                .ok();
            if done.as_deref() == Some(digest.as_str()) {
                continue;
            }
            let content = STANDARD.encode(encrypt_events(&seed, part)?);
            let tags = json!([["d", d], ["t", chain_tag]]);
            events.push(RelayOutgoing { d, digest, event: sign_nostr_event(&sk, (now_ms / 1000) as u64, tags, content)? });
            if events.len() >= MAX_PUBLISH {
                break 'outer;
            }
        }
    }
    Ok(RelayBatch { chain_tag, since: (since_ms / 1000) as u64, events })
}

/// Called when the relay answers `["OK", id, true, ...]`.
pub fn mark_relay_published(conn: &Connection, d: &str, digest: &str) -> Result<(), String> {
    conn.execute("INSERT INTO relay_published (d, digest) VALUES (?1, ?2) ON CONFLICT(d) DO UPDATE SET digest = excluded.digest", params![d, digest])
        .map_err(|e| format!("Mark relay published: {e}"))?;
    Ok(())
}

/// Verifies and applies one relay event. Returns how many new ledger events landed.
pub fn ingest_nostr_event(conn: &mut Connection, ev: &Value) -> Result<usize, String> {
    if ev["kind"].as_u64() != Some(RELAY_KIND) || !verify_nostr_event(ev) {
        return Ok(0);
    }
    let cfg = get_chain_config(conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let tag = derive_chain_id_hash(&seed);
    let ours = ev["tags"].as_array().is_some_and(|t| t.iter().any(|x| x[0] == "t" && x[1] == tag.as_str()));
    if !ours {
        return Ok(0);
    }
    let raw = STANDARD.decode(ev["content"].as_str().unwrap_or("")).map_err(|_| "Bad relay content".to_string())?;
    let mut applied = 0;
    let mut max_hlc = String::new();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for mut e in decrypt_events(&seed, &raw)? {
        e.synced_relay = 1;
        max_hlc = max_hlc.max(e.hlc.clone());
        if apply_ledger_event(&tx, &e)? {
            applied += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    if !max_hlc.is_empty() {
        let _ = observe_remote_hlc(conn, &max_hlc, &cfg.node_id);
    }
    Ok(applied)
}

pub fn now_ms() -> u128 {
    current_epoch_ms()
}
