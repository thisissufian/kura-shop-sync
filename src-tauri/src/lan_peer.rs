use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::crypto_chain::{
    decode_seed_b64, decrypt_events, derive_chain_id_hash, encrypt_events,
};
use crate::hlc::observe_remote_hlc;
use crate::ledger::apply_ledger_event;
use crate::ledger_queries::{events_after_hlc, get_chain_config};
use crate::models::LedgerEvent;

pub const SYNC_TCP_PORT: u16 = 42850;

#[derive(Serialize, Deserialize)]
struct TcpHandshake {
    chain_id_hash: String,
    node_id: String,
    latest_hlc: String,
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

pub fn read_sync_snapshot(
    db: &Mutex<Connection>,
    since_hlc: &str,
) -> Result<([u8; 16], String, String, String, Vec<LedgerEvent>), String> {
    let conn = db.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let seed = decode_seed_b64(&cfg.seed_b64)?;
    let chain_hash = derive_chain_id_hash(&seed);
    let events = events_after_hlc(&conn, since_hlc)?;
    Ok((seed, chain_hash, cfg.node_id, cfg.last_hlc, events))
}

fn apply_remote_events(
    db: &Mutex<Connection>,
    seed: &[u8; 16],
    packet: &[u8],
) -> Result<usize, String> {
    if packet.is_empty() {
        return Ok(0);
    }
    let events = decrypt_events(seed, packet)?;
    if events.is_empty() {
        return Ok(0);
    }
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

pub async fn handle_tcp_peer(
    mut stream: TcpStream,
    db: Arc<Mutex<Connection>>,
) -> Result<(), String> {
    let hs_bytes = read_frame(&mut stream).await?;
    let peer_hs: TcpHandshake = serde_json::from_slice(&hs_bytes).map_err(|e| e.to_string())?;
    let (seed, my_hash, my_node, my_hlc, to_send) = read_sync_snapshot(&db, &peer_hs.latest_hlc)?;
    if peer_hs.chain_id_hash != my_hash {
        return Err("Chain ID mismatch".to_string());
    }
    let reply_hs = serde_json::to_vec(&TcpHandshake {
        chain_id_hash: my_hash,
        node_id: my_node,
        latest_hlc: my_hlc,
    })
    .map_err(|e| e.to_string())?;
    write_frame(&mut stream, &reply_hs).await?;
    let enc_out = if to_send.is_empty() {
        Vec::new()
    } else {
        encrypt_events(&seed, &to_send)?
    };
    write_frame(&mut stream, &enc_out).await?;
    let enc_in = read_frame(&mut stream).await?;
    let _ = apply_remote_events(&db, &seed, &enc_in)?;
    Ok(())
}

pub async fn sync_with_peer_ip(db: &Mutex<Connection>, peer_addr: &str) -> Result<usize, String> {
    let target = if peer_addr.contains(':') {
        peer_addr.trim().to_string()
    } else {
        format!("{}:{SYNC_TCP_PORT}", peer_addr.trim())
    };
    let (seed, my_hash, my_node, my_hlc, _) = read_sync_snapshot(db, "")?;
    let mut stream = tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(&target))
        .await
        .map_err(|_| format!("Timed out connecting to {target}"))?
        .map_err(|e| format!("Connect {target}: {e}"))?;

    let hs = serde_json::to_vec(&TcpHandshake {
        chain_id_hash: my_hash.clone(),
        node_id: my_node,
        latest_hlc: my_hlc,
    })
    .map_err(|e| e.to_string())?;
    write_frame(&mut stream, &hs).await?;

    let peer_hs_bytes = read_frame(&mut stream).await?;
    let peer_hs: TcpHandshake =
        serde_json::from_slice(&peer_hs_bytes).map_err(|e| e.to_string())?;
    if peer_hs.chain_id_hash != my_hash {
        return Err("Peer belongs to a different Sync Chain".to_string());
    }

    let enc_in = read_frame(&mut stream).await?;
    let applied = apply_remote_events(db, &seed, &enc_in)?;

    let (_, _, _, _, my_delta) = read_sync_snapshot(db, &peer_hs.latest_hlc)?;
    let enc_out = if my_delta.is_empty() {
        Vec::new()
    } else {
        encrypt_events(&seed, &my_delta)?
    };
    write_frame(&mut stream, &enc_out).await?;
    let _ = db.lock().map(|c| {
        c.execute(
            "UPDATE ledger_events SET synced_lan = 1 WHERE synced_lan = 0",
            params![],
        )
    });
    Ok(applied)
}
