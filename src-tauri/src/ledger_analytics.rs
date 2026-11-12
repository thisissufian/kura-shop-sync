use rusqlite::Connection;
use std::collections::HashMap;

use crate::models::{BillItem, OwnerAnalytics, TerminalSalesSummary};

pub fn compute_owner_analytics(conn: &Connection) -> Result<OwnerAnalytics, String> {
    let mut cost_map: HashMap<String, i64> = HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT sku, cost_price_minor FROM products")
            .map_err(|e| format!("Prepare cost map: {e}"))?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
            .map_err(|e| format!("Query cost map: {e}"))?;
        for row in rows {
            let (sku, cost) = row.map_err(|e| e.to_string())?;
            cost_map.insert(sku, cost);
        }
    }

    let mut gross_revenue_minor: i64 = 0;
    let mut estimated_cogs_minor: i64 = 0;
    let mut total_bills_count: i64 = 0;
    let mut voided_bills_count: i64 = 0;
    let mut per_node: HashMap<String, (i64, i64)> = HashMap::new();

    {
        let mut stmt = conn
            .prepare("SELECT node_id, items_json, total_minor, voided FROM bills")
            .map_err(|e| format!("Prepare bills analytics: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                ))
            })
            .map_err(|e| format!("Query bills analytics: {e}"))?;

        for row in rows {
            let (node_id, items_json, total_minor, voided) = row.map_err(|e| e.to_string())?;
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
            for item in items {
                let unit_cost = cost_map.get(&item.sku).copied().unwrap_or(0);
                estimated_cogs_minor =
                    estimated_cogs_minor.saturating_add(unit_cost.saturating_mul(item.qty));
            }
        }
    }

    let net_profit_minor = gross_revenue_minor.saturating_sub(estimated_cogs_minor);
    let margin_bps = if gross_revenue_minor > 0 {
        net_profit_minor.saturating_mul(10_000) / gross_revenue_minor
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

    Ok(OwnerAnalytics {
        gross_revenue_minor,
        estimated_cogs_minor,
        net_profit_minor,
        margin_bps,
        total_bills_count,
        voided_bills_count,
        terminal_breakdown,
    })
}
