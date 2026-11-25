use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::crypto_chain::{decode_seed_b64, decrypt_bytes, decrypt_events, derive_chain_id_hash, encrypt_bytes, encrypt_events};
use crate::hlc::observe_remote_hlc;
use crate::ledger::apply_ledger_event;
use crate::ledger_queries::{events_after_hlc, get_chain_config};
use crate::models::LedgerEvent;
use crate::sync_digest::{events_missing_for, local_buckets, state_fingerprint, Bucket, MAX_EVENTS_PER_SYNC};

pub const SYNC_TCP_PORT: u16 = 42850;

#[derive(Serialize, Deserialize)]
struct TcpHandshake {
    chain_id_hash: String,
    node_id: String,
    latest_hlc: String,
    /// AES-GCM(JSON Vec<Bucket>) in base64. Empty from pre-S1 peers, which
    /// fall back to "events newer than latest_hlc".
    #[serde(default)]
    buckets_enc: String,
}

async fn write_frame(stream: &mut TcpStream, data: &[u8]) -> Result<(), String> {
    let len = (data.len() as u32).to_be_bytes();
    stream.write_all(&len).await.map_err(|e| e.to_string())?;
    stream.write_all(data).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn read_frame(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await.map_err(|e| e.to_string())?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > 8 * 1024 * 1024 {
        return Err("Sync frame exceeds 8MB limit".to_string());
    }
    let mut buf = vec![0u8; len];
    stream.read_exact(&mut buf).await.map_err(|e| e.to_string())?;
    Ok(buf)
}

/// (chain hash, node id, last HLC, ledger fingerprint) for the UDP beacon.
pub fn read_beacon_info(db: &Mutex<Connection>) -> Result<(String, String, String, String), String> {
    let conn = db.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let fp = state_fingerprint(&local_buckets(&conn)?);
    Ok((derive_chain_id_hash(&seed), cfg.node_id, cfg.last_hlc, fp))
}

fn local_handshake(db: &Mutex<Connection>) -> Result<([u8; 16], TcpHandshake), String> {
    let conn = db.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let buckets = serde_json::to_vec(&local_buckets(&conn)?).map_err(|e| e.to_string())?;
    let hs = TcpHandshake {
        chain_id_hash: derive_chain_id_hash(&seed),
        node_id: cfg.node_id,
        latest_hlc: cfg.last_hlc,
        buckets_enc: STANDARD.encode(encrypt_bytes(&seed, &buckets)?),
    };
    Ok((seed, hs))
}

/// Encrypted batch of what the peer is missing, judged from its handshake.
fn outgoing_for(db: &Mutex<Connection>, seed: &[u8; 16], peer: &TcpHandshake) -> Result<Vec<u8>, String> {
    let conn = db.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let events = if peer.buckets_enc.is_empty() {
        events_after_hlc(&conn, &peer.latest_hlc)?
    } else {
        let raw = STANDARD.decode(&peer.buckets_enc).map_err(|_| "Bad peer buckets".to_string())?;
        let theirs: Vec<Bucket> =
            serde_json::from_slice(&decrypt_bytes(seed, &raw)?).map_err(|e| format!("Peer buckets: {e}"))?;
        events_missing_for(&conn, &theirs, MAX_EVENTS_PER_SYNC)?
    };
    if events.is_empty() {
        Ok(Vec::new())
    } else {
        encrypt_events(seed, &events)
    }
}

fn apply_remote_events(db: &Mutex<Connection>, seed: &[u8; 16], packet: &[u8]) -> Result<usize, String> {
    if packet.is_empty() {
        return Ok(0);
    }
    let events: Vec<LedgerEvent> = decrypt_events(seed, packet)?;
    let mut conn = db.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let mut applied = 0usize;
    let mut max_hlc = String::new();
    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for mut ev in events {
            ev.synced_lan = 1;
            if ev.hlc > max_hlc {
                max_hlc = ev.hlc.clone();
            }
            if apply_ledger_event(&tx, &ev)? {
                applied += 1;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
    }
    if !max_hlc.is_empty() {
        let _ = observe_remote_hlc(&conn, &max_hlc, &cfg.node_id);
    }
    let _ = conn.execute("UPDATE ledger_events SET synced_lan = 1 WHERE synced_lan = 0", []);
    Ok(applied)
}

pub async fn handle_tcp_peer(mut stream: TcpStream, db: Arc<Mutex<Connection>>) -> Result<(), String> {
    let peer_hs: TcpHandshake = serde_json::from_slice(&read_frame(&mut stream).await?).map_err(|e| e.to_string())?;
    let (seed, my_hs) = local_handshake(&db)?;
    if peer_hs.chain_id_hash != my_hs.chain_id_hash {
        return Err("Chain ID mismatch".to_string());
    }
    let enc_out = outgoing_for(&db, &seed, &peer_hs)?;
    write_frame(&mut stream, &serde_json::to_vec(&my_hs).map_err(|e| e.to_string())?).await?;
    write_frame(&mut stream, &enc_out).await?;
    let enc_in = read_frame(&mut stream).await?;
    apply_remote_events(&db, &seed, &enc_in)?;
    Ok(())
}

pub async fn sync_with_peer_ip(db: &Mutex<Connection>, peer_addr: &str) -> Result<usize, String> {
    let target = if peer_addr.contains(':') {
        peer_addr.trim().to_string()
    } else {
        format!("{}:{SYNC_TCP_PORT}", peer_addr.trim())
    };
    let (seed, my_hs) = local_handshake(db)?;
    let mut stream = tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(&target))
        .await
        .map_err(|_| format!("Timed out connecting to {target}"))?
        .map_err(|e| format!("Connect {target}: {e}"))?;
    write_frame(&mut stream, &serde_json::to_vec(&my_hs).map_err(|e| e.to_string())?).await?;

    let peer_hs: TcpHandshake = serde_json::from_slice(&read_frame(&mut stream).await?).map_err(|e| e.to_string())?;
    if peer_hs.chain_id_hash != my_hs.chain_id_hash {
        return Err("Peer belongs to a different Sync Chain".to_string());
    }
    // Decide what to send before applying the peer's batch, so we don't echo it back.
    let enc_out = outgoing_for(db, &seed, &peer_hs)?;
    let enc_in = read_frame(&mut stream).await?;
    let applied = apply_remote_events(db, &seed, &enc_in)?;
    write_frame(&mut stream, &enc_out).await?;
    Ok(applied)
}
