use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::models::LedgerEvent;

#[derive(Debug, Clone)]
pub struct ParsedPairing {
    pub seed_b64: String,
    pub role: String,
    pub node_id: String,
    pub shop_name: String,
    pub lan_addr: Option<String>,
}

pub fn generate_seed() -> [u8; 16] {
    let mut seed = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut seed);
    seed
}

pub fn encode_seed_b64(seed: &[u8; 16]) -> String {
    URL_SAFE_NO_PAD.encode(seed)
}

pub fn decode_seed_b64(b64: &str) -> Result<[u8; 16], String> {
    let bytes = URL_SAFE_NO_PAD
        .decode(b64.trim())
        .map_err(|_| "Invalid base64url sync seed".to_string())?;
    bytes
        .try_into()
        .map_err(|_| "Sync seed must be exactly 16 bytes (128 bits)".to_string())
}

pub fn derive_sync_key(seed: &[u8; 16]) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(None, seed);
    let mut okm = [0u8; 32];
    let _ = hk.expand(b"kura-sync-aes-256-gcm", &mut okm);
    okm
}

pub fn derive_owner_token_hex(seed: &[u8; 16]) -> String {
    let hk = Hkdf::<Sha256>::new(None, seed);
    let mut okm = [0u8; 32];
    let _ = hk.expand(b"kura-owner-role-verify", &mut okm);
    okm[..8].iter().map(|b| format!("{b:02x}")).collect()
}

pub fn derive_chain_id_hash(seed: &[u8; 16]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"kura-chain-id");
    hasher.update(seed);
    let digest = hasher.finalize();
    digest[..8].iter().map(|b| format!("{b:02x}")).collect()
}

pub fn encrypt_bytes(seed: &[u8; 16], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let key = derive_sync_key(seed);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init: {e}"))?;
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|_| "AES-256-GCM encryption failed".to_string())?;
    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt_bytes(seed: &[u8; 16], packet: &[u8]) -> Result<Vec<u8>, String> {
    if packet.len() < 13 {
        return Err("Encrypted packet too short".to_string());
    }
    let key = derive_sync_key(seed);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("Cipher init: {e}"))?;
    let (nonce_bytes, ct) = packet.split_at(12);
    cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ct)
        .map_err(|_| "Decryption failed (wrong sync chain key)".to_string())
}

pub fn encrypt_events(seed: &[u8; 16], events: &[LedgerEvent]) -> Result<Vec<u8>, String> {
    let plaintext = serde_json::to_vec(events).map_err(|e| format!("Serialize events: {e}"))?;
    encrypt_bytes(seed, &plaintext)
}

pub fn decrypt_events(seed: &[u8; 16], packet: &[u8]) -> Result<Vec<LedgerEvent>, String> {
    let plaintext = decrypt_bytes(seed, packet)?;
    serde_json::from_slice(&plaintext).map_err(|e| format!("Invalid decrypted payload: {e}"))
}

fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn build_pairing_uri(
    seed: &[u8; 16],
    seed_b64: &str,
    role: &str,
    node_id: &str,
    shop_name: &str,
    lan_addr: &str,
) -> String {
    let base = format!(
        "kura://join?seed={}&role={}&node={}&shop={}&lan={}",
        url_encode(seed_b64),
        url_encode(role),
        url_encode(node_id),
        url_encode(shop_name),
        url_encode(lan_addr)
    );
    if role == "OWNER" {
        format!("{base}&auth={}", derive_owner_token_hex(seed))
    } else {
        base
    }
}

pub fn parse_pairing_uri(uri: &str) -> Result<ParsedPairing, String> {
    let query = uri
        .trim()
        .strip_prefix("kura://join?")
        .ok_or_else(|| "URI must start with kura://join?".to_string())?;
    let mut seed_b64 = String::new();
    let mut role = "CASHIER".to_string();
    let mut node_id = "K2".to_string();
    let mut shop_name = "Kura Shop".to_string();
    let mut lan_addr = None;
    let mut auth_hex: Option<String> = None;

    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let val = url_decode(v);
            match k {
                "seed" => seed_b64 = val,
                "role" => role = val.to_ascii_uppercase(),
                "node" if !val.trim().is_empty() => node_id = val.trim().to_ascii_uppercase(),
                "shop" if !val.trim().is_empty() => shop_name = val,
                "lan" if !val.trim().is_empty() => lan_addr = Some(val),
                "auth" if !val.trim().is_empty() => auth_hex = Some(val),
                _ => {}
            }
        }
    }
    if role != "OWNER" && role != "CASHIER" {
        return Err("Role must be OWNER or CASHIER".to_string());
    }
    let seed = decode_seed_b64(&seed_b64)?;
    if role == "OWNER" {
        if let Some(ref provided) = auth_hex {
            if provided != &derive_owner_token_hex(&seed) {
                return Err("Owner authorization token verification failed".to_string());
            }
        }
    }
    Ok(ParsedPairing {
        seed_b64,
        role,
        node_id,
        shop_name,
        lan_addr,
    })
}
