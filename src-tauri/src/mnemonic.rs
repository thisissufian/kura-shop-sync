use sha2::{Digest, Sha256};

const PREFIXES: [&str; 64] = [
    "ba", "be", "bi", "bo", "bu", "ca", "co", "cu", "da", "de", "di", "do", "du", "fa", "fe", "fi",
    "fo", "ga", "ge", "go", "gu", "ha", "he", "hi", "ho", "hu", "ja", "jo", "ka", "ke", "ki", "ko",
    "ku", "la", "le", "li", "lo", "lu", "ma", "me", "mi", "mo", "mu", "na", "ne", "ni", "no", "pa",
    "pe", "pi", "po", "ra", "re", "ri", "ro", "ru", "sa", "se", "si", "so", "ta", "te", "ti", "to",
];

const SUFFIXES: [&str; 32] = [
    "ck", "ft", "ld", "lf", "lk", "lm", "lp", "lt", "mb", "mp", "nd", "ng", "nk", "nt", "pt", "rb",
    "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rt", "sh", "sk", "sp", "st", "th", "wn", "xt", "ze",
];

/// Encodes 128-bit seed + 4-bit SHA-256 checksum into 12 deterministic words.
pub fn seed_to_phrase(seed: &[u8; 16]) -> String {
    let hash = Sha256::digest(seed);
    let csum = (hash[0] >> 4) & 0x0F;
    let bits: u128 = u128::from_be_bytes(*seed);
    let mut words = Vec::with_capacity(12);
    let mut all_bits = Vec::with_capacity(132);
    for i in (0..128).rev() {
        all_bits.push(((bits >> i) & 1) as u8);
    }
    for i in (0..4).rev() {
        all_bits.push(((csum >> i) & 1) as u8);
    }
    for chunk in all_bits.chunks(11) {
        let mut idx = 0usize;
        for &b in chunk {
            idx = (idx << 1) | (b as usize);
        }
        words.push(format!("{}{}", PREFIXES[idx / 32], SUFFIXES[idx % 32]));
    }
    words.join(" ")
}

/// Decodes and checksum-verifies a 12-word recovery phrase back into 16 bytes.
pub fn phrase_to_seed(phrase: &str) -> Result<[u8; 16], String> {
    let parts: Vec<&str> = phrase.split_whitespace().collect();
    if parts.len() != 12 {
        return Err("Recovery phrase must contain exactly 12 words".to_string());
    }
    let mut all_bits = Vec::with_capacity(132);
    for w in parts {
        let lower = w.to_ascii_lowercase();
        if lower.len() != 4 {
            return Err(format!("Invalid recovery word: {w}"));
        }
        let p = PREFIXES.iter().position(|&x| x == &lower[0..2]);
        let s = SUFFIXES.iter().position(|&x| x == &lower[2..4]);
        let idx = match (p, s) {
            (Some(pi), Some(si)) => pi * 32 + si,
            _ => return Err(format!("Unrecognized recovery word: {w}")),
        };
        for b in (0..11).rev() {
            all_bits.push(((idx >> b) & 1) as u8);
        }
    }
    let mut seed_val: u128 = 0;
    for &b in &all_bits[..128] {
        seed_val = (seed_val << 1) | (b as u128);
    }
    let seed = seed_val.to_be_bytes();
    let mut csum = 0u8;
    for &b in &all_bits[128..132] {
        csum = (csum << 1) | b;
    }
    let expected = (Sha256::digest(seed)[0] >> 4) & 0x0F;
    if csum != expected {
        return Err("Recovery phrase checksum mismatch".to_string());
    }
    Ok(seed)
}
