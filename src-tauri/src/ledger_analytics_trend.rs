use rusqlite::Connection;
use std::collections::HashMap;

use crate::hlc::{hlc_local_date, local_date_str};
use crate::models::{BillItem, DailySalesPoint};

pub fn compute_7day_trend(
    conn: &Connection,
    now_ms: u128,
    offset_minutes: i64,
    cost_map: &HashMap<String, i64>,
) -> Result<Vec<DailySalesPoint>, String> {
    let mut days_map: HashMap<String, (i64, i64, i64)> = HashMap::new();
    let mut day_labels: Vec<String> = Vec::with_capacity(7);

    for i in (0..7).rev() {
        let day_ms = now_ms.saturating_sub(i as u128 * 86_400_000);
        let date_str = local_date_str(day_ms, offset_minutes);
        day_labels.push(date_str.clone());
        days_map.insert(date_str, (0, 0, 0));
    }

    let mut stmt = conn
        .prepare("SELECT items_json, total_minor, hlc FROM bills WHERE voided = 0")
        .map_err(|e| format!("Prepare trend: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, String>(2)?))
        })
        .map_err(|e| format!("Query trend: {e}"))?;

    for r in rows {
        let (items_json, total, hlc) = r.map_err(|e| e.to_string())?;
        let date = hlc_local_date(&hlc, offset_minutes)
            .unwrap_or_else(|| hlc.get(..10).unwrap_or("").to_string());
        if let Some(entry) = days_map.get_mut(&date) {
            entry.0 = entry.0.saturating_add(total);
            entry.2 += 1;
            let items: Vec<BillItem> = serde_json::from_str(&items_json).unwrap_or_default();
            let mut cogs = 0i64;
            for it in items {
                let cost = it
                    .unit_cost_minor
                    .unwrap_or_else(|| cost_map.get(&it.sku).copied().unwrap_or(0));
                cogs = cogs.saturating_add(cost.saturating_mul(it.qty));
            }
            entry.1 = entry.1.saturating_add(total.saturating_sub(cogs));
        }
    }

    let out = day_labels
        .into_iter()
        .map(|d| {
            let (rev, profit, count) = days_map.get(&d).copied().unwrap_or((0, 0, 0));
            let short_label = if d.len() >= 10 { d[5..].replace('-', "/") } else { d };
            DailySalesPoint {
                date_label: short_label,
                revenue_minor: rev,
                profit_minor: profit,
                bills_count: count,
            }
        })
        .collect();

    Ok(out)
}
