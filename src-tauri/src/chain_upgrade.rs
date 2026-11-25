//! Upgrading a chain created before S4 (open to cashier escalation) to a secured one.
//!
//! The owner moves the shop to a NEW chain key with an owner key, signing the
//! owner-only history it holds. A fresh key splits the network cleanly: devices
//! that haven't re-paired keep syncing among themselves on the old chain, instead
//! of trading unsigned copies with secured devices forever. The new invites
//! carry `from=` (a proof of the old chain key). A device still on that old chain re-pairs WITHOUT
//! a wipe: it keeps its sales, drops owner-only events that fail the new owner key
//! (removing anything a cashier forged), rebuilds, then pulls the owner's signed
//! copies on its first sync.
use rusqlite::{params, Connection};

use crate::crypto_chain::{decode_seed_b64, encode_seed_b64, generate_seed};
use crate::pairing::upgrade_proof;
use crate::ledger_queries::{all_ledger_events, get_chain_config};
use crate::ledger_rebuild::rebuild_projections;
use crate::owner_sig::{encode_secret, generate_owner_secret, is_owner_only, owner_pk_hex, sign_event, verify_event};

/// Owner-only: moves this device's legacy chain to a new secured chain. Returns how many
/// historical owner events were signed. Other devices must scan the new QR afterwards.
pub fn secure_chain_db(conn: &mut Connection) -> Result<usize, String> {
    let cfg = get_chain_config(conn)?;
    if cfg.role != "OWNER" {
        return Err("Only an OWNER device can secure the Sync Chain".to_string());
    }
    if !cfg.owner_pk.is_empty() {
        return Err("This Sync Chain is already secured".to_string());
    }
    let secret = generate_owner_secret();
    let pk = owner_pk_hex(&secret)?;
    let events = all_ledger_events(conn)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut signed = 0usize;
    for ev in events.iter().filter(|e| is_owner_only(&e.event_type)) {
        tx.execute("UPDATE ledger_events SET sig = ?1 WHERE event_id = ?2", params![sign_event(&secret, ev)?, ev.event_id])
            .map_err(|e| format!("Sign history: {e}"))?;
        signed += 1;
    }
    tx.execute(
        "UPDATE chain_config SET seed_b64 = ?1, owner_secret = ?2, owner_pk = ?3, prev_seed_b64 = ?4 WHERE id = 1",
        params![encode_seed_b64(&generate_seed()), encode_secret(&secret), pk, cfg.seed_b64],
    )
    .map_err(|e| format!("Secure chain_config: {e}"))?;
    tx.execute("DELETE FROM rejected_events", []).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(signed)
}

/// True when the invite's `from` proves knowledge of the chain this device is on now.
pub fn is_migration_from_here(conn: &Connection, from: Option<&str>, new_seed_b64: &str) -> Result<bool, String> {
    let Some(from) = from.filter(|s| !s.is_empty()) else { return Ok(false) };
    let cfg = get_chain_config(conn)?;
    Ok(upgrade_proof(&decode_seed_b64(&cfg.seed_b64)?, new_seed_b64) == from)
}

/// Re-pairs onto the secured successor of this device's chain, keeping local data.
pub fn migrate_join(
    conn: &mut Connection,
    seed_b64: &str,
    role: &str,
    owner_secret: &str,
    owner_pk: &str,
) -> Result<usize, String> {
    if owner_pk.is_empty() {
        return Err("Upgrade invite is missing the owner key".to_string());
    }
    let events = all_ledger_events(conn)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut dropped = 0usize;
    for ev in events.iter().filter(|e| is_owner_only(&e.event_type) && !verify_event(owner_pk, e)) {
        tx.execute("DELETE FROM ledger_events WHERE event_id = ?1", params![ev.event_id]).map_err(|e| e.to_string())?;
        dropped += 1;
    }
    tx.execute(
        "UPDATE chain_config SET seed_b64 = ?1, role = ?2, owner_secret = ?3, owner_pk = ?4, is_linked = 1 WHERE id = 1",
        params![seed_b64, role, owner_secret, owner_pk],
    )
    .map_err(|e| format!("Migrate chain_config: {e}"))?;
    tx.execute("DELETE FROM rejected_events", []).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    rebuild_projections(conn)?;
    Ok(dropped)
}
