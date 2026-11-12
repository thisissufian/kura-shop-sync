use rand::RngCore;
use rusqlite::{params, Connection};
use std::time::{SystemTime, UNIX_EPOCH};

/// Converts Unix epoch milliseconds to ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SS.mmmZ`).
pub fn format_iso_ms(epoch_ms: u128) -> String {
    let total_secs = (epoch_ms / 1000) as i64;
    let ms = (epoch_ms % 1000) as u32;
    let days = total_secs.div_euclid(86_400);
    let rem = total_secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    let hh = rem / 3600;
    let mm = (rem % 3600) / 60;
    let ss = rem % 60;
    format!("{y:04}-{m:02}-{d:02}T{hh:02}:{mm:02}:{ss:02}.{ms:03}Z")
}

/// Howard Hinnant's civil-from-days algorithm (epoch 1970-01-01).
fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + if m <= 2 { 1 } else { 0 }, m, d)
}

fn current_epoch_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Parses `{ISO8601_ms}-{4DigitCounter}-{NodeID}` into `(iso_part, counter)`.
fn split_hlc(hlc: &str) -> (&str, u32) {
    // ISO8601_ms is 24 chars: YYYY-MM-DDTHH:MM:SS.mmmZ
    if hlc.len() >= 29 && hlc.as_bytes()[24] == b'-' {
        let iso = &hlc[..24];
        let rest = &hlc[25..];
        if let Some((cnt_str, _)) = rest.split_once('-') {
            if let Ok(cnt) = cnt_str.parse::<u32>() {
                return (iso, cnt);
            }
        }
    }
    ("", 0)
}

/// Generates a strictly monotonic Hybrid Logical Clock string for this node.
pub fn next_hlc(conn: &Connection, node_id: &str) -> Result<String, String> {
    let last_hlc: String = conn
        .query_row("SELECT last_hlc FROM chain_config WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_default();

    let now_iso = format_iso_ms(current_epoch_ms());
    let (last_iso, last_cnt) = split_hlc(&last_hlc);

    let (iso, cnt) = if now_iso.as_str() > last_iso {
        (now_iso, 0u32)
    } else {
        (last_iso.to_string(), (last_cnt + 1).min(9999))
    };

    let next = format!("{iso}-{cnt:04}-{node_id}");
    conn.execute(
        "UPDATE chain_config SET last_hlc = ?1 WHERE id = 1",
        params![next],
    )
    .map_err(|e| format!("Failed updating HLC: {e}"))?;
    Ok(next)
}

/// Advances local HLC upon observing a remote event's HLC so causal order holds.
pub fn observe_remote_hlc(conn: &Connection, remote_hlc: &str, node_id: &str) -> Result<String, String> {
    let last_hlc: String = conn
        .query_row("SELECT last_hlc FROM chain_config WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_default();
    let now_iso = format_iso_ms(current_epoch_ms());
    let (l_iso, l_cnt) = split_hlc(&last_hlc);
    let (r_iso, r_cnt) = split_hlc(remote_hlc);

    let max_iso = [now_iso.as_str(), l_iso, r_iso].into_iter().max().unwrap_or(now_iso.as_str());
    let cnt = if max_iso == l_iso && max_iso == r_iso {
        l_cnt.max(r_cnt) + 1
    } else if max_iso == l_iso {
        l_cnt + 1
    } else if max_iso == r_iso {
        r_cnt + 1
    } else {
        0
    };

    let merged = format!("{max_iso}-{:04}-{node_id}", cnt.min(9999));
    conn.execute(
        "UPDATE chain_config SET last_hlc = ?1 WHERE id = 1",
        params![merged],
    )
    .map_err(|e| format!("Failed merging remote HLC: {e}"))?;
    Ok(merged)
}

/// Generates a collision-free invoice number: `{node_id}-{YYMMDD}-{4DigitDailySeq}`.
pub fn next_invoice_number(conn: &Connection, node_id: &str) -> Result<String, String> {
    let days = (current_epoch_ms() / 1000 / 86_400) as i64;
    let (y, m, d) = civil_from_days(days);
    let prefix = format!("{node_id}-{:02}{m:02}{d:02}-", y % 100);
    let pattern = format!("{prefix}%");
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bills WHERE bill_no LIKE ?1",
            params![pattern],
            |r| r.get(0),
        )
        .unwrap_or(0);
    Ok(format!("{prefix}{:04}", count + 1))
}

/// Generates a unique ledger event ID tied to the HLC and random entropy.
pub fn new_event_id(hlc: &str) -> String {
    let mut bytes = [0u8; 4];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    format!(
        "ev-{hlc}-{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3]
    )
}
