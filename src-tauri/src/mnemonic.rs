use sha2::{Digest, Sha256};

pub(crate) const PREFIXES: [&str; 64] = [
    "ba", "be", "bi", "bo", "bu", "ca", "co", "cu", "da", "de", "di", "do", "du", "fa", "fe", "fi",
    "fo", "ga", "ge", "go", "gu", "ha", "he", "hi", "ho", "hu", "ja", "jo", "ka", "ke", "ki", "ko",
    "ku", "la", "le", "li", "lo", "lu", "ma", "me", "mi", "mo", "mu", "na", "ne", "ni", "no", "pa",
    "pe", "pi", "po", "ra", "re", "ri", "ro", "ru", "sa", "se", "si", "so", "ta", "te", "ti", "to",
];

pub(crate) const SUFFIXES: [&str; 32] = [
    "ck", "ft", "ld", "lf", "lk", "lm", "lp", "lt", "mb", "mp", "nd", "ng", "nk", "nt", "pt", "rb",
    "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rt", "sh", "sk", "sp", "st", "th", "wn", "xt", "ze",
];

/// BIP39-style packing: data bits + (len*8/32) SHA-256 checksum bits, 11 bits per word.
/// 16 bytes -> 12 words (chain seed), 32 bytes -> 24 words (seed + owner secret, S4).
fn encode_words(data: &[u8]) -> String {
    let cs_bits = data.len() * 8 / 32;
    let hash = Sha256::digest(data);
    let mut bits: Vec<u8> = data.iter().flat_map(|b| (0..8).rev().map(move |i| (b >> i) & 1)).collect();
    bits.extend((0..cs_bits).map(|i| (hash[i / 8] >> (7 - i % 8)) & 1));
    bits.chunks(11)
        .map(|chunk| {
            let idx = chunk.iter().fold(0usize, |acc, &b| (acc << 1) | b as usize);
            format!("{}{}", PREFIXES[idx / 32], SUFFIXES[idx % 32])
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_words(phrase: &str) -> Result<Vec<u8>, String> {
    let parts: Vec<&str> = phrase.split_whitespace().collect();
    if parts.len() != 12 && parts.len() != 24 {
        return Err("Recovery phrase must contain exactly 12 or 24 words".to_string());
    }
    let mut bits = Vec::with_capacity(parts.len() * 11);
    for w in parts {
        let lower = w.to_ascii_lowercase();
        let (p, s) = match (lower.get(0..2), lower.get(2..4), lower.len()) {
            (Some(a), Some(b), 4) => (PREFIXES.iter().position(|&x| x == a), SUFFIXES.iter().position(|&x| x == b)),
            _ => return Err(format!("Invalid recovery word: {w}")),
        };
        let idx = match (p, s) {
            (Some(pi), Some(si)) => pi * 32 + si,
            _ => return Err(format!("Unrecognized recovery word: {w}")),
        };
        bits.extend((0..11).rev().map(|b| ((idx >> b) & 1) as u8));
    }
    let n_bytes = bits.len() * 32 / 33 / 8;
    let data: Vec<u8> = bits[..n_bytes * 8].chunks(8).map(|c| c.iter().fold(0u8, |a, &b| (a << 1) | b)).collect();
    let hash = Sha256::digest(&data);
    let ok = bits[n_bytes * 8..].iter().enumerate().all(|(i, &b)| b == (hash[i / 8] >> (7 - i % 8)) & 1);
    if !ok {
        return Err("Recovery phrase checksum mismatch".to_string());
    }
    Ok(data)
}

/// 12-word phrase for the chain seed.
pub fn seed_to_phrase(seed: &[u8; 16]) -> String {
    encode_words(seed)
}

/// 24-word owner phrase: chain seed followed by the owner secret.
pub fn owner_phrase(seed: &[u8; 16], owner_secret: &[u8; 16]) -> String {
    encode_words(&[seed.as_slice(), owner_secret.as_slice()].concat())
}

/// Decodes a 12- or 24-word phrase into (seed, owner secret if 24 words).
pub fn phrase_to_secrets(phrase: &str) -> Result<([u8; 16], Option<[u8; 16]>), String> {
    let data = decode_words(phrase)?;
    let seed: [u8; 16] = data[..16].try_into().map_err(|_| "Bad phrase length".to_string())?;
    let owner = if data.len() == 32 { Some(data[16..].try_into().map_err(|_| "Bad phrase length".to_string())?) } else { None };
    Ok((seed, owner))
}

/// Chain seed from a 12- or 24-word phrase.
#[cfg(test)]
pub fn phrase_to_seed(phrase: &str) -> Result<[u8; 16], String> {
    phrase_to_secrets(phrase).map(|(seed, _)| seed)
}
