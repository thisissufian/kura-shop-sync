//! Rebuilds every projection table by replaying `ledger_events` in HLC order.
//! Used once on upgrade (S2/S3): older versions dropped out-of-order effects and
//! let stock/payment events bump `updated_hlc`, so existing rows may be wrong.
use rusqlite::{params, Connection};

use crate::ledger::apply_ledger_event;
use crate::ledger_queries::all_ledger_events;

/// Bump when projection rules change and existing databases must be replayed.
pub const PROJECTION_VERSION: i64 = 1;

pub fn rebuild_projections(conn: &mut Connection) -> Result<usize, String> {
    let mut events = all_ledger_events(conn)?;
    events.sort_by(|a, b| a.hlc.cmp(&b.hlc).then_with(|| a.event_id.cmp(&b.event_id)));
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(
        "DELETE FROM products; DELETE FROM bills; DELETE FROM bill_voids;
         DELETE FROM customers; DELETE FROM suppliers; DELETE FROM expenses;
         DELETE FROM ledger_events;
         UPDATE chain_config SET settings_hlc = '' WHERE id = 1;",
    )
    .map_err(|e| format!("Clear projections: {e}"))?;
    let mut skipped = 0usize;
    for ev in &events {
        if apply_ledger_event(&tx, ev).is_err() {
            // Keep a malformed event in the log rather than lose it or block startup.
            skipped += 1;
            tx.execute(
                "INSERT OR IGNORE INTO ledger_events (event_id, hlc, node_id, event_type, payload_json, synced_lan, synced_relay, sig)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![ev.event_id, ev.hlc, ev.node_id, ev.event_type, ev.payload_json, ev.synced_lan, ev.synced_relay, ev.sig],
            )
            .map_err(|e| format!("Keep skipped event: {e}"))?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(skipped)
}

/// Replays the ledger once per PROJECTION_VERSION bump. Failure leaves the old
/// projections untouched (the transaction rolls back) and retries next start.
pub fn migrate_projections(conn: &mut Connection) {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap_or(0);
    if current >= PROJECTION_VERSION {
        return;
    }
    if rebuild_projections(conn).is_ok() {
        let _ = conn.execute_batch(&format!("PRAGMA user_version = {PROJECTION_VERSION}"));
    }
}
