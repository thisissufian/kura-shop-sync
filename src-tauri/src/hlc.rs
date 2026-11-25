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

/// Howard Hinnant's days-from-civil algorithm (inverse of `civil_from_days`).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = y - if m <= 2 { 1 } else { 0 };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

pub fn parse_iso_ms(iso: &str) -> Option<u128> {
    let b = iso.as_bytes();
    if b.len() != 24 || b[4] != b'-' || b[7] != b'-' || b[10] != b'T'
        || b[13] != b':' || b[16] != b':' || b[19] != b'.' || b[23] != b'Z'
    {
        return None;
    }
    let y: i64 = iso[0..4].parse().ok()?;
    let m: i64 = iso[5..7].parse().ok()?;
    let d: i64 = iso[8..10].parse().ok()?;
    let hh: i64 = iso[11..13].parse().ok()?;
    let mm: i64 = iso[14..16].parse().ok()?;
    let ss: i64 = iso[17..19].parse().ok()?;
    let ms: u128 = iso[20..23].parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) || hh > 23 || mm > 59 || ss > 59 || ms > 999 {
        return None;
    }
    let days = days_from_civil(y, m, d);
    if days < 0 {
        return None;
    }
    Some(((days * 86_400 + hh * 3600 + mm * 60 + ss) as u128) * 1000 + ms)
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

/// Advances ISO timestamp by 1 ms and resets counter to 0 when counter exceeds 9999.
fn normalize_hlc(iso: &str, cnt: u32) -> (String, u32) {
    if cnt > 9999 {
        let next_iso = parse_iso_ms(iso)
            .map(|ms| format_iso_ms(ms + 1))
            .unwrap_or_else(|| format_iso_ms(current_epoch_ms()));
        (next_iso, 0)
    } else {
        (iso.to_string(), cnt)
    }
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
        normalize_hlc(last_iso, last_cnt.saturating_add(1))
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
    let raw_cnt = if max_iso == l_iso && max_iso == r_iso {
        l_cnt.max(r_cnt).saturating_add(1)
    } else if max_iso == l_iso {
        l_cnt.saturating_add(1)
    } else if max_iso == r_iso {
        r_cnt.saturating_add(1)
    } else {
        0
    };

    let (merged_iso, cnt) = normalize_hlc(max_iso, raw_cnt);
    let merged = format!("{merged_iso}-{cnt:04}-{node_id}");
    conn.execute(
        "UPDATE chain_config SET last_hlc = ?1 WHERE id = 1",
        params![merged],
    )
    .map_err(|e| format!("Failed merging remote HLC: {e}"))?;
    Ok(merged)
}

/// Returns `(year, month, day)` in the shop's local timezone for a UTC epoch-ms timestamp.
pub fn local_civil_date(epoch_ms: u128, offset_minutes: i64) -> (i64, i64, i64) {
    let shifted_ms = (epoch_ms as i128) + (offset_minutes as i128) * 60_000;
    let days = shifted_ms.div_euclid(86_400_000) as i64;
    civil_from_days(days)
}

/// Formats `YYYY-MM-DD` in the shop's local timezone for a UTC epoch-ms timestamp.
pub fn local_date_str(epoch_ms: u128, offset_minutes: i64) -> String {
    let (y, m, d) = local_civil_date(epoch_ms, offset_minutes);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Converts a UTC HLC or ISO-Z prefix into a shop-local `YYYY-MM-DD` date.
pub fn hlc_local_date(hlc: &str, offset_minutes: i64) -> Option<String> {
    if let Some(ms) = hlc.get(..24).and_then(parse_iso_ms) {
        return Some(local_date_str(ms, offset_minutes));
    }
    let iso20 = hlc.get(..20)?;
    if iso20.ends_with('Z') {
        let with_ms = format!("{}.000Z", &iso20[..19]);
        if let Some(ms) = parse_iso_ms(&with_ms) {
            return Some(local_date_str(ms, offset_minutes));
        }
    }
    None
}

/// Generates a collision-free invoice number: `{node_id}-{YYMMDD}-{4DigitDailySeq}`.
pub fn next_invoice_number(conn: &Connection, node_id: &str) -> Result<String, String> {
    next_invoice_number_at(conn, node_id, current_epoch_ms())
}

pub fn next_invoice_number_at(conn: &Connection, node_id: &str, now_ms: u128) -> Result<String, String> {
    let offset_minutes: i64 = conn
        .query_row("SELECT utc_offset_minutes FROM chain_config WHERE id = 1", [], |r| r.get(0))
        .unwrap_or(360);
    let (y, m, d) = local_civil_date(now_ms, offset_minutes);
    let prefix = format!("{node_id}-{:02}{m:02}{d:02}-", y.rem_euclid(100));
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
