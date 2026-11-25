//! Gap-tolerant sync summaries (S1). The ledger is split into buckets of one
//! origin node x one UTC day. Each bucket is summarised by its event count and an
//! XOR of event-ID hashes, so two devices can find every bucket where their sets
//! differ, whatever order or path events took. They never rely on "latest HLC".
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;

use crate::models::LedgerEvent;

/// Max events sent per direction in one exchange; repeated syncs carry the rest.
pub const MAX_EVENTS_PER_SYNC: usize = 3000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Bucket {
    pub node: String,
    pub day: String,
    pub count: i64,
    pub digest: String,
}

fn id_hash(event_id: &str) -> u64 {
    let h = Sha256::digest(event_id.as_bytes());
    u64::from_be_bytes(h[..8].try_into().unwrap_or([0; 8]))
}

type StampKey = (String, i64, i64, String);
static CACHE: Mutex<Option<(StampKey, Vec<Bucket>)>> = Mutex::new(None);

/// Buckets sorted by (day, node). Cached per database until its (count, max rowid,
/// newest-row event ID) stamp changes; the ID catches a wipe followed by same-size refill.
pub fn local_buckets(conn: &Connection) -> Result<Vec<Bucket>, String> {
    let (count, max_rowid, last_id): (i64, i64, String) = conn
        .query_row(
            "SELECT COUNT(*) + (SELECT COUNT(*) FROM rejected_events), COALESCE(MAX(rowid), 0),
                    COALESCE((SELECT event_id FROM ledger_events ORDER BY rowid DESC LIMIT 1), '')
             FROM ledger_events",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| format!("Ledger stamp: {e}"))?;
    let key: StampKey = (conn.path().unwrap_or("").to_string(), count, max_rowid, last_id);
    if let Ok(guard) = CACHE.lock() {
        if let Some((k, b)) = guard.as_ref() {
            if *k == key {
                return Ok(b.clone());
            }
        }
    }
    let mut stmt = conn
        .prepare(
            "SELECT node_id, substr(hlc, 1, 10), event_id FROM ledger_events
             UNION ALL SELECT node_id, substr(hlc, 1, 10), event_id FROM rejected_events",
        )
        .map_err(|e| format!("Prepare buckets: {e}"))?;
    let mut map: BTreeMap<(String, String), (i64, u64)> = BTreeMap::new();
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)))
        .map_err(|e| format!("Query buckets: {e}"))?;
    for row in rows {
        let (node, day, id) = row.map_err(|e| e.to_string())?;
        let slot = map.entry((day, node)).or_insert((0, 0));
        slot.0 += 1;
        slot.1 ^= id_hash(&id);
    }
    let buckets: Vec<Bucket> = map
        .into_iter()
        .map(|((day, node), (count, x))| Bucket { node, day, count, digest: format!("{x:016x}") })
        .collect();
    if let Ok(mut guard) = CACHE.lock() {
        *guard = Some((key, buckets.clone()));
    }
    Ok(buckets)
}

/// One short fingerprint of the whole ledger, for LAN beacons.
pub fn state_fingerprint(buckets: &[Bucket]) -> String {
    let mut h = Sha256::new();
    for b in buckets {
        h.update(format!("{}|{}|{}|{};", b.node, b.day, b.count, b.digest).as_bytes());
    }
    h.finalize()[..8].iter().map(|b| format!("{b:02x}")).collect()
}

pub fn bucket_events(conn: &Connection, node: &str, day: &str) -> Result<Vec<LedgerEvent>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT event_id, hlc, node_id, event_type, payload_json, synced_lan, synced_relay, sig
             FROM ledger_events WHERE node_id = ?1 AND hlc >= ?2 AND hlc < ?3 ORDER BY hlc",
        )
        .map_err(|e| format!("Prepare bucket events: {e}"))?;
    let rows = stmt
        .query_map(params![node, format!("{day}T"), format!("{day}U")], |r| {
            Ok(LedgerEvent {
                event_id: r.get(0)?,
                hlc: r.get(1)?,
                node_id: r.get(2)?,
                event_type: r.get(3)?,
                payload_json: r.get(4)?,
                synced_lan: r.get(5)?,
                synced_relay: r.get(6)?,
                sig: r.get(7)?,
            })
        })
        .map_err(|e| format!("Query bucket events: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Events from every local bucket that the peer lacks or holds differently,
/// oldest bucket first, stopping once `cap` is reached (whole buckets only).
pub fn events_missing_for(conn: &Connection, peer: &[Bucket], cap: usize) -> Result<Vec<LedgerEvent>, String> {
    let theirs: HashMap<(&str, &str), &Bucket> = peer.iter().map(|b| ((b.node.as_str(), b.day.as_str()), b)).collect();
    let mut out = Vec::new();
    for mine in local_buckets(conn)? {
        if theirs.get(&(mine.node.as_str(), mine.day.as_str())).is_some_and(|t| **t == mine) {
            continue;
        }
        if !out.is_empty() && out.len() + mine.count as usize > cap {
            break;
        }
        out.extend(bucket_events(conn, &mine.node, &mine.day)?);
    }
    Ok(out)
}
