use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::UdpSocket as StdUdpSocket;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::net::{TcpListener, UdpSocket};

use crate::lan_peer::{handle_tcp_peer, read_sync_snapshot, sync_with_peer_ip, SYNC_TCP_PORT};

pub const SYNC_UDP_PORT: u16 = 42851;

#[derive(Clone)]
pub struct LanSyncState {
    pub peers: Arc<Mutex<HashMap<String, Instant>>>,
    pub tcp_port: Arc<Mutex<u16>>,
}

impl LanSyncState {
    pub fn new() -> Self {
        Self {
            peers: Arc::new(Mutex::new(HashMap::new())),
            tcp_port: Arc::new(Mutex::new(SYNC_TCP_PORT)),
        }
    }

    pub fn active_peer_count(&self) -> usize {
        if let Ok(mut map) = self.peers.lock() {
            let now = Instant::now();
            map.retain(|_, ts| now.duration_since(*ts) < Duration::from_secs(15));
            map.len()
        } else {
            0
        }
    }

    pub fn bound_port(&self) -> u16 {
        self.tcp_port.lock().map(|p| *p).unwrap_or(SYNC_TCP_PORT)
    }
}

#[derive(Serialize, Deserialize)]
struct UdpBeacon {
    chain_id_hash: String,
    node_id: String,
    latest_hlc: String,
    tcp_port: u16,
}

pub fn detect_local_ip() -> String {
    if let Ok(sock) = StdUdpSocket::bind("0.0.0.0:0") {
        if sock.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = sock.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

pub fn spawn_lan_sync(db: Arc<Mutex<Connection>>, lan_state: LanSyncState) {
    let db_tcp = db.clone();
    let state_tcp = lan_state.clone();
    tauri::async_runtime::spawn(async move {
        let mut bound = None;
        for port in SYNC_TCP_PORT..=SYNC_TCP_PORT + 10 {
            if let Ok(listener) = TcpListener::bind(("0.0.0.0", port)).await {
                if let Ok(mut p) = state_tcp.tcp_port.lock() {
                    *p = port;
                }
                bound = Some(listener);
                break;
            }
        }
        let Some(listener) = bound else { return };
        while let Ok((stream, _)) = listener.accept().await {
            let db_conn = db_tcp.clone();
            tauri::async_runtime::spawn(async move {
                let _ = handle_tcp_peer(stream, db_conn).await;
            });
        }
    });

    tauri::async_runtime::spawn(async move {
        let Ok(udp) = UdpSocket::bind(("0.0.0.0", SYNC_UDP_PORT)).await else { return };
        let _ = udp.set_broadcast(true);
        let mut buf = [0u8; 1024];
        let mut tick = tokio::time::interval(Duration::from_secs(3));
        loop {
            tokio::select! {
                _ = tick.tick() => {
                    if let Ok((_, hash, node_id, latest_hlc, _)) = read_sync_snapshot(&db, "") {
                        let beacon = UdpBeacon {
                            chain_id_hash: hash,
                            node_id,
                            latest_hlc,
                            tcp_port: lan_state.bound_port(),
                        };
                        if let Ok(bytes) = serde_json::to_vec(&beacon) {
                            let _ = udp.send_to(&bytes, ("255.255.255.255", SYNC_UDP_PORT)).await;
                        }
                    }
                }
                Ok((len, src)) = udp.recv_from(&mut buf) => {
                    if let Ok(b) = serde_json::from_slice::<UdpBeacon>(&buf[..len]) {
                        if let Ok((_, my_hash, my_node, my_hlc, _)) = read_sync_snapshot(&db, "") {
                            if b.chain_id_hash == my_hash && b.node_id != my_node {
                                if let Ok(mut map) = lan_state.peers.lock() {
                                    map.insert(b.node_id.clone(), Instant::now());
                                }
                                if b.latest_hlc != my_hlc {
                                    let addr = format!("{}:{}", src.ip(), b.tcp_port);
                                    let _ = sync_with_peer_ip(&db, &addr).await;
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}
