//! `kura://join?...` pairing URIs. Secured chains (S4) add `opk` (owner public
//! key) to every invite and `osec` (owner secret) to owner invites only.
use crate::crypto_chain::{decode_seed_b64, derive_owner_token_hex, url_decode, url_encode};

#[derive(Debug, Clone)]
pub struct ParsedPairing {
    pub seed_b64: String,
    pub role: String,
    /// Parsed for old invites only; joiners now generate their own ID (T6).
    #[allow(dead_code)]
    pub node_id: String,
    pub shop_name: String,
    pub lan_addr: Option<String>,
    /// Secured chains (S4): owner public key, and the owner secret on owner invites.
    pub owner_pk: Option<String>,
    pub owner_secret: Option<String>,
    /// Upgrade proof (`upgrade_proof`): devices on the old chain re-pair without a wipe.
    pub migrate_from: Option<String>,
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
    let (mut owner_pk, mut owner_secret, mut migrate_from) = (None, None, None);

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
                "opk" if !val.trim().is_empty() => owner_pk = Some(val),
                "osec" if !val.trim().is_empty() => owner_secret = Some(val),
                "from" if !val.trim().is_empty() => migrate_from = Some(val),
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
        owner_pk,
        owner_secret,
        migrate_from,
    })
}

/// Appends owner-key params for a secured chain. Cashier invites never get `osec`.
pub fn with_owner_params(uri: String, role: &str, owner_pk: &str, owner_secret: &str) -> String {
    if owner_pk.is_empty() {
        return uri;
    }
    let mut out = format!("{uri}&opk={owner_pk}");
    if role == "OWNER" && !owner_secret.is_empty() {
        out.push_str(&format!("&osec={owner_secret}"));
    }
    out
}

/// Upgrade invites carry `from` = proof of the OLD chain key bound to the new one.
/// Chain ids are public (beacons, relay tags), so a bare id would let a stranger's QR
/// pull a device's whole history onto their chain without the usual wipe.
pub fn upgrade_proof(old_seed: &[u8; 16], new_seed_b64: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(b"kura-upgrade-v1");
    h.update(old_seed);
    h.update(new_seed_b64.as_bytes());
    h.finalize()[..16].iter().map(|b| format!("{b:02x}")).collect()
}

pub fn with_upgrade_from(uri: String, prev_seed_b64: &str, new_seed_b64: &str) -> String {
    match decode_seed_b64(prev_seed_b64) {
        Ok(old) if !prev_seed_b64.is_empty() => format!("{uri}&from={}", upgrade_proof(&old, new_seed_b64)),
        _ => uri,
    }
}
