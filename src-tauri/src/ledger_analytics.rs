use rusqlite::Connection;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::hlc::format_iso_ms;
use crate::models::{BillItem, DailySalesPoint, OwnerAnalytics, TerminalSalesSummary};

pub fn compute_owner_analytics(conn: &Connection, period: &str) -> Result<OwnerAnalytics, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let norm_period = match period.to_uppercase().as_str() {
        "TODAY" => "TODAY",
        "7D" => "7D",
        "30D" => "30D",
        "YEARLY" => "YEARLY",
        _ => "ALL",
    };

    let cutoff_iso = match norm_period {
        "TODAY" => {
            let today_start_ms = (now_ms / 86_400_000) * 86_400_000;
            format_iso_ms(today_start_ms)[..10].to_string()
        }
        "7D" => format_iso_ms(now_ms.saturating_sub(7 * 86_400_000))[..10].to_string(),
        "30D" => format_iso_ms(now_ms.saturating_sub(30 * 86_400_000))[..10].to_string(),
        "YEARLY" => format_iso_ms(now_ms.saturating_sub(365 * 86_400_000))[..10].to_string(),
        _ => String::new(),
    };

    let mut cost_map: HashMap<String, i64> = HashMap::new();
    let mut inventory_cost_value_minor: i64 = 0;
    let mut retail_market_value_minor: i64 = 0;
    let mut total_inventory_units: i64 = 0;

    {
        let mut stmt = conn
            .prepare("SELECT sku, cost_price_minor, sell_price_minor, stock_qty FROM products")
            .map_err(|e| format!("Prepare products valuation: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            })
            .map_err(|e| format!("Query products valuation: {e}"))?;
        for r in rows {
            let (sku, cost, sell, qty) = r.map_err(|e| e.to_string())?;
            cost_map.insert(sku, cost);
            if qty > 0 {
                inventory_cost_value_minor =
                    inventory_cost_value_minor.saturating_add(cost.saturating_mul(qty));
                retail_market_value_minor =
                    retail_market_value_minor.saturating_add(sell.saturating_mul(qty));
                total_inventory_units = total_inventory_units.saturating_add(qty);
            }
        }
    }

    let customer_receivables_minor: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(balance_due_minor), 0) FROM customers",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let supplier_payables_minor: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(payable_balance_minor), 0) FROM suppliers",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let operating_expenses_minor: i64 = if cutoff_iso.is_empty() {
        conn.query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM expenses",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0)
    } else {
        conn.query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM expenses WHERE substr(hlc, 1, 10) >= ?1",
            [&cutoff_iso],
            |r| r.get(0),
        )
        .unwrap_or(0)
    };

    let mut gross_revenue_minor: i64 = 0;
    let mut estimated_cogs_minor: i64 = 0;
    let mut total_bills_count: i64 = 0;
    let mut voided_bills_count: i64 = 0;
    let mut per_node: HashMap<String, (i64, i64)> = HashMap::new();

    {
        let mut stmt = conn
            .prepare("SELECT node_id, items_json, total_minor, voided, hlc FROM bills")
            .map_err(|e| format!("Prepare bills: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| format!("Query bills: {e}"))?;

        for r in rows {
            let (node_id, items_json, total_minor, voided, hlc) = r.map_err(|e| e.to_string())?;
            let date_str = hlc.get(..10).unwrap_or("");
            if !cutoff_iso.is_empty() && date_str < cutoff_iso.as_str() {
                continue;
            }
            if voided != 0 {
                voided_bills_count += 1;
                continue;
            }
            total_bills_count += 1;
            gross_revenue_minor = gross_revenue_minor.saturating_add(total_minor);

            let entry = per_node.entry(node_id).or_insert((0, 0));
            entry.0 += 1;
            entry.1 = entry.1.saturating_add(total_minor);

            let items: Vec<BillItem> = serde_json::from_str(&items_json).unwrap_or_default();
            for it in items {
                let unit_cost = cost_map.get(&it.sku).copied().unwrap_or(0);
                estimated_cogs_minor =
                    estimated_cogs_minor.saturating_add(unit_cost.saturating_mul(it.qty));
            }
        }
    }

    let gross_profit_minor = gross_revenue_minor.saturating_sub(estimated_cogs_minor);
    let net_operating_profit_minor =
        gross_profit_minor.saturating_sub(operating_expenses_minor);
    let margin_bps = if gross_revenue_minor > 0 {
        gross_profit_minor.saturating_mul(10_000) / gross_revenue_minor
    } else {
        0
    };

    let mut terminal_breakdown: Vec<TerminalSalesSummary> = per_node
        .into_iter()
        .map(|(node_id, (bills_count, revenue_minor))| TerminalSalesSummary {
            node_id,
            bills_count,
            revenue_minor,
        })
        .collect();
    terminal_breakdown.sort_by(|a, b| a.node_id.cmp(&b.node_id));

    let daily_trend = compute_7day_trend(conn, now_ms, &cost_map)?;

    Ok(OwnerAnalytics {
        period: norm_period.to_string(),
        gross_revenue_minor,
        estimated_cogs_minor,
        gross_profit_minor,
        operating_expenses_minor,
        net_operating_profit_minor,
        margin_bps,
        total_bills_count,
        voided_bills_count,
        inventory_cost_value_minor,
        retail_market_value_minor,
        total_inventory_units,
        customer_receivables_minor,
        supplier_payables_minor,
        terminal_breakdown,
        daily_trend,
    })
}

fn compute_7day_trend(
    conn: &Connection,
    now_ms: u128,
    cost_map: &HashMap<String, i64>,
) -> Result<Vec<DailySalesPoint>, String> {
    let mut days_map: HashMap<String, (i64, i64, i64)> = HashMap::new();
    let mut day_labels: Vec<String> = Vec::with_capacity(7);

    for i in (0..7).rev() {
        let day_ms = now_ms.saturating_sub(i as u128 * 86_400_000);
        let iso = format_iso_ms(day_ms);
        let date_str = iso[..10].to_string();
        day_labels.push(date_str.clone());
        days_map.insert(date_str, (0, 0, 0));
    }

    let oldest_date = day_labels.first().cloned().unwrap_or_default();
    let mut stmt = conn
        .prepare("SELECT items_json, total_minor, hlc FROM bills WHERE voided = 0 AND substr(hlc, 1, 10) >= ?1")
        .map_err(|e| format!("Prepare trend: {e}"))?;
    let rows = stmt
        .query_map([&oldest_date], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, String>(2)?))
        })
        .map_err(|e| format!("Query trend: {e}"))?;

    for r in rows {
        let (items_json, total, hlc) = r.map_err(|e| e.to_string())?;
        let date = hlc.get(..10).unwrap_or("").to_string();
        if let Some(entry) = days_map.get_mut(&date) {
            entry.0 = entry.0.saturating_add(total);
            entry.2 += 1;
            let items: Vec<BillItem> = serde_json::from_str(&items_json).unwrap_or_default();
            let mut cogs = 0i64;
            for it in items {
                let cost = cost_map.get(&it.sku).copied().unwrap_or(0);
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
