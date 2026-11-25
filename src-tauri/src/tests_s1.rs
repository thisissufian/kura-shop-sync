use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use serde_json::json;

use crate::lan_peer::{handle_tcp_peer, read_beacon_info, sync_with_peer_ip};
use crate::ledger::apply_ledger_event;
use crate::ledger_init::init_db;
use crate::models::LedgerEvent;
use crate::sync_digest::{events_missing_for, local_buckets};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_s1_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

fn adj(day: &str, t: u32, node: &str) -> LedgerEvent {
    let hlc = format!("{day}T10:00:00.000Z-{t:04}-{node}");
    LedgerEvent {
        event_id: format!("ev-{node}-{day}-{t}"),
        hlc,
        node_id: node.into(),
        event_type: "STOCK_ADJUST".into(),
        payload_json: json!({"sku": "SKU-101", "delta": 1, "reason": "count"}).to_string(),
        synced_lan: 0,
        synced_relay: 0,
    }
}

fn put(conn: &mut Connection, evs: &[LedgerEvent]) {
    let tx = conn.transaction().unwrap();
    for e in evs {
        apply_ledger_event(&tx, e).unwrap();
    }
    tx.commit().unwrap();
}

fn has(conn: &Connection, id: &str) -> bool {
    conn.query_row("SELECT EXISTS(SELECT 1 FROM ledger_events WHERE event_id = ?1)", [id], |r| r.get(0)).unwrap()
}

/// Two devices on one chain. A holds a mid-history event B never got; B holds an
/// offline event older than anything A has. Old "newer than your latest HLC" sync
/// moved neither; bucket digests must move both.
#[tokio::test(flavor = "multi_thread")]
async fn test_lan_sync_fills_gaps_and_old_offline_events() {
    let (pa, pb) = (temp_db("a"), temp_db("b"));
    let mut a = init_db(&pa).unwrap();
    let mut b = init_db(&pb).unwrap();
    let seed: String = a.query_row("SELECT seed_b64 FROM chain_config", [], |r| r.get(0)).unwrap();
    b.execute("UPDATE chain_config SET seed_b64 = ?1", [&seed]).unwrap();

    let shared = [adj("2026-11-20", 1, "KCCCC"), adj("2026-11-22", 3, "KCCCC")];
    put(&mut a, &shared);
    put(&mut b, &shared);
    put(&mut a, &[adj("2026-11-21", 2, "KCCCC")]);
    put(&mut b, &[adj("2026-11-01", 1, "KBBBB")]);
    let late = "2026-11-22T10:00:00.000Z-0003-KCCCC";
    a.execute("UPDATE chain_config SET last_hlc = ?1", [late]).unwrap();
    b.execute("UPDATE chain_config SET last_hlc = ?1", [late]).unwrap();

    let a = Arc::new(Mutex::new(a));
    let b = Mutex::new(b);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap().to_string();
    let server_db = a.clone();
    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        handle_tcp_peer(stream, server_db).await
    });
    sync_with_peer_ip(&b, &addr).await.unwrap();
    server.await.unwrap().unwrap();

    let (a, b) = (a.lock().unwrap(), b.lock().unwrap());
    assert!(has(&b, "ev-KCCCC-2026-11-21-2"), "gap behind an equal latest HLC must be filled");
    assert!(has(&a, "ev-KBBBB-2026-11-01-1"), "offline event older than the peer's clock must sync");
    assert_eq!(local_buckets(&a).unwrap(), local_buckets(&b).unwrap(), "ledgers must match after one sync");
    let stock = |c: &Connection| -> i64 { c.query_row("SELECT stock_qty FROM products WHERE sku = 'SKU-101'", [], |r| r.get(0)).unwrap() };
    let adjusts: i64 = a.query_row("SELECT COUNT(*) FROM ledger_events WHERE event_type = 'STOCK_ADJUST'", [], |r| r.get(0)).unwrap();
    assert_eq!(adjusts, 4 + 5 + 5, "4 test events + both devices' 5 starter adjustments");
    assert_eq!(stock(&a), stock(&b));
    drop((a, b));
    for p in [pa, pb] {
        let _ = std::fs::remove_dir_all(p.parent().unwrap());
    }
}

#[test]
fn test_missing_events_respect_cap_but_send_whole_buckets() {
    let path = temp_db("cap");
    let mut conn = init_db(&path).unwrap();
    put(&mut conn, &[adj("2026-01-01", 1, "KX"), adj("2026-01-01", 2, "KX"), adj("2026-01-02", 1, "KX")]);
    let first = events_missing_for(&conn, &[], 1).unwrap();
    assert_eq!(first.len(), 2, "first bucket goes out whole even above the cap");
    let all = events_missing_for(&conn, &[], 10_000).unwrap().len();
    let peer_same = local_buckets(&conn).unwrap();
    assert_eq!(events_missing_for(&conn, &peer_same, 10_000).unwrap().len(), 0);
    assert_eq!(all, 3 + 10, "3 test events + 10 starter events");
    drop(conn);
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

#[test]
fn test_beacon_fingerprint_changes_when_any_event_lands() {
    let path = temp_db("fp");
    let mut conn = init_db(&path).unwrap();
    let db = Mutex::new(Connection::open(&path).unwrap());
    let before = read_beacon_info(&db).unwrap().3;
    put(&mut conn, &[adj("2025-05-05", 1, "KOLD")]);
    let after = read_beacon_info(&db).unwrap().3;
    assert_ne!(before, after, "an old-dated event must still change the fingerprint");
    drop((conn, db));
    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
