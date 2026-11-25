//! Owner signatures (S4). Every device holds the chain seed, so a seed-derived
//! token can't tell owners from cashiers. Secured chains therefore also have a
//! 16-byte owner secret that only owner devices hold (owner QR, 24-word phrase).
//! Owner-only events carry a BIP340 Schnorr signature from a key derived from it,
//! and every device rejects owner-only events that fail to verify.
//! Chains with an empty `owner_pk` (created before S4) keep the old open behaviour.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hkdf::Hkdf;
use k256::schnorr::{Signature, SigningKey, VerifyingKey};
use rand::RngCore;
use rusqlite::{params, Connection, Transaction};
use sha2::{Digest, Sha256};

use crate::ledger::apply_ledger_event;
use crate::models::LedgerEvent;

pub const OWNER_ONLY: [&str; 5] =
    ["PRODUCT_UPSERT", "BILL_VOIDED", "STOCK_PURCHASED", "SUPPLIER_PAYMENT", "SHOP_SETTINGS_UPDATED"];

pub fn is_owner_only(event_type: &str) -> bool {
    OWNER_ONLY.contains(&event_type)
}

pub fn generate_owner_secret() -> [u8; 16] {
    let mut s = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut s);
    s
}

pub fn encode_secret(secret: &[u8; 16]) -> String {
    URL_SAFE_NO_PAD.encode(secret)
}

pub fn decode_secret(b64: &str) -> Result<[u8; 16], String> {
    let bytes = URL_SAFE_NO_PAD.decode(b64.trim()).map_err(|_| "Invalid owner key".to_string())?;
    bytes.try_into().map_err(|_| "Owner key must be 16 bytes".to_string())
}

fn signing_key(secret: &[u8; 16]) -> Result<SigningKey, String> {
    let hk = Hkdf::<Sha256>::new(None, secret);
    for counter in 0u8..=255 {
        let mut okm = [0u8; 32];
        hk.expand(&[b"kura-owner-sign-v1".as_slice(), &[counter]].concat(), &mut okm)
            .map_err(|_| "Owner key derivation failed".to_string())?;
        if let Ok(k) = SigningKey::from_bytes(&okm) {
            return Ok(k);
        }
    }
    Err("Owner key derivation failed".to_string())
}

/// Hex x-only public key (64 chars) for an owner secret.
pub fn owner_pk_hex(secret: &[u8; 16]) -> Result<String, String> {
    Ok(hex(&signing_key(secret)?.verifying_key().to_bytes()))
}

fn message(ev: &LedgerEvent) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(b"kura-owner-sig-v1");
    for field in [&ev.event_id, &ev.hlc, &ev.node_id, &ev.event_type, &ev.payload_json] {
        h.update((field.len() as u32).to_be_bytes());
        h.update(field.as_bytes());
    }
    h.finalize().into()
}

pub fn sign_event(secret: &[u8; 16], ev: &LedgerEvent) -> Result<String, String> {
    let mut aux = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut aux);
    let sig = signing_key(secret)?.sign_raw(&message(ev), &aux).map_err(|_| "Signing failed".to_string())?;
    Ok(hex(&sig.to_bytes()))
}

pub fn verify_event(pk_hex: &str, ev: &LedgerEvent) -> bool {
    let (Some(pk), Some(sig)) = (unhex(pk_hex), unhex(&ev.sig)) else { return false };
    // k256 panics on wrong-length input, so check sizes before parsing.
    if pk.len() != 32 || sig.len() != 64 {
        return false;
    }
    let (Ok(vk), Ok(sig)) = (VerifyingKey::from_bytes(&pk), Signature::try_from(sig.as_slice())) else {
        return false;
    };
    vk.verify_raw(&message(ev), &sig).is_ok()
}

fn owner_keys(conn: &Connection) -> Result<(String, String), String> {
    conn.query_row("SELECT owner_secret, owner_pk FROM chain_config WHERE id = 1", [], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| format!("Read owner keys: {e}"))
}

/// Gate used by `apply_ledger_event` for every event, local or remote.
pub fn owner_sig_ok(conn: &Connection, ev: &LedgerEvent) -> Result<bool, String> {
    if !is_owner_only(&ev.event_type) {
        return Ok(true);
    }
    let (_, pk) = owner_keys(conn)?;
    Ok(pk.is_empty() || verify_event(&pk, ev))
}

/// Applies an event created on this device, signing it first when it is owner-only.
/// Never use for events from sync or backups: that would launder forgeries.
pub fn apply_local_event(tx: &Transaction, ev: &LedgerEvent) -> Result<bool, String> {
    let mut ev = ev.clone();
    if is_owner_only(&ev.event_type) {
        let (secret, pk) = owner_keys(tx)?;
        if !secret.is_empty() {
            ev.sig = sign_event(&decode_secret(&secret)?, &ev)?;
        } else if !pk.is_empty() {
            return Err("This device has no owner key for this secured chain. Re-pair it with the Owner QR.".to_string());
        }
    }
    apply_ledger_event(tx, &ev)
}

/// Owner fields to store when joining: (owner_secret_b64, owner_pk_hex).
/// A secured invite (`opk`) only grants OWNER together with a matching secret.
pub fn join_owner_fields(role: &str, secret_b64: Option<&str>, pk_hex: Option<&str>) -> Result<(String, String), String> {
    let secret = secret_b64.filter(|s| !s.is_empty()).map(decode_secret).transpose()?;
    let derived = secret.as_ref().map(owner_pk_hex).transpose()?;
    let pk = match (pk_hex.filter(|s| !s.is_empty()), derived.as_deref()) {
        (Some(given), Some(d)) if given != d => return Err("Owner key does not match this chain".to_string()),
        (Some(given), _) => given.to_string(),
        (None, Some(d)) => d.to_string(),
        (None, None) => return Ok((String::new(), String::new())),
    };
    match (role, secret) {
        ("OWNER", Some(s)) => Ok((encode_secret(&s), pk)),
        ("OWNER", None) => Err("This chain is secured: owner access needs the Owner QR or the 24-word owner phrase.".to_string()),
        _ => Ok((String::new(), pk)),
    }
}

/// Remembers an event that failed the owner check, so sync digests stop re-offering it.
pub fn record_rejected(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    tx.execute(
        "INSERT OR IGNORE INTO rejected_events (event_id, hlc, node_id, event_type, payload_json, sig) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![ev.event_id, ev.hlc, ev.node_id, ev.event_type, ev.payload_json, ev.sig],
    )
    .map_err(|e| format!("Record rejected event: {e}"))?;
    Ok(())
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn unhex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}
