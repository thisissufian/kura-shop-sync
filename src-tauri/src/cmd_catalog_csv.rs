use rusqlite::params;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::commands::AppState;
use crate::hlc::{format_iso_ms, new_event_id, next_hlc};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_queries::{get_chain_config, list_products};
use crate::models::{LedgerEvent, PdfExportResult, Product};
use crate::printer::barcode_pdf::generate_barcode_labels_pdf;

pub(crate) fn format_decimal(minor: i64) -> String {
    let neg = minor < 0;
    let abs = minor.unsigned_abs();
    format!("{}{}.{:02}", if neg { "-" } else { "" }, abs / 100, abs % 100)
}

pub(crate) fn parse_decimal_minor(raw: &str) -> i64 {
    let s = raw.trim().replace(',', "");
    if s.is_empty() {
        return 0;
    }
    let (w, f) = s.split_once('.').unwrap_or((&s, ""));
    let whole: i64 = w.parse().unwrap_or(0);
    let frac_str = format!("{f}00");
    let frac: i64 = frac_str[..2].parse().unwrap_or(0);
    whole.saturating_mul(100).saturating_add(frac)
}

fn csv_escape(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut cols = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' && chars.peek() == Some(&'"') {
                cur.push('"');
                chars.next();
            } else if c == '"' {
                in_quotes = false;
            } else {
                cur.push(c);
            }
        } else if c == '"' {
            in_quotes = true;
        } else if c == ',' {
            cols.push(cur.trim().to_string());
            cur.clear();
        } else {
            cur.push(c);
        }
    }
    cols.push(cur.trim().to_string());
    cols
}

fn today_stamp() -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let iso = format_iso_ms(ms);
    format!("{}{}{}", &iso[2..4], &iso[5..7], &iso[8..10])
}

#[tauri::command]
pub fn export_barcode_labels_pdf(
    skus: Vec<String>,
    copies_per_sku: u32,
    state: State<'_, AppState>,
) -> Result<PdfExportResult, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let all = list_products(&conn, cfg.role != "OWNER")?;
    let copies = copies_per_sku.clamp(1, 48);
    let selected: Vec<Product> = if skus.is_empty() {
        all
    } else {
        all.into_iter().filter(|p| skus.contains(&p.sku)).collect()
    };
    if selected.is_empty() {
        return Err("No products selected for barcode stickers".to_string());
    }
    let mut expanded = Vec::with_capacity(selected.len() * copies as usize);
    for p in selected {
        for _ in 0..copies {
            expanded.push(p.clone());
        }
    }
    generate_barcode_labels_pdf(
        &state.receipts_dir,
        &cfg.shop_name,
        &cfg.currency_symbol,
        &expanded,
        &today_stamp(),
    )
}

#[tauri::command]
pub fn export_catalog_csv(state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let products = list_products(&conn, cfg.role != "OWNER")?;
    let mut out = String::from(
        "sku,name,barcode,category,sell_price,cost_price,stock_qty,low_stock_threshold\n",
    );
    for p in products {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            csv_escape(&p.sku),
            csv_escape(&p.name),
            csv_escape(p.barcode.as_deref().unwrap_or("")),
            csv_escape(&p.category),
            format_decimal(p.sell_price_minor),
            format_decimal(p.cost_price_minor),
            p.stock_qty,
            p.low_stock_threshold
        ));
    }
    std::fs::create_dir_all(&state.receipts_dir).map_err(|e| format!("Create CSV dir: {e}"))?;
    let path = state.receipts_dir.join(format!("kura-catalog-{}.csv", today_stamp()));
    std::fs::write(&path, out.as_bytes()).map_err(|e| format!("Write CSV: {e}"))?;
    Ok(out)
}

#[tauri::command]
pub fn import_catalog_csv(csv_content: String, state: State<'_, AppState>) -> Result<u32, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can import CSV catalog".to_string());
    }
    let mut count = 0u32;
    let mut pending_events: Vec<LedgerEvent> = Vec::new();
    for (idx, line) in csv_content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let cols = parse_csv_line(trimmed);
        if cols.len() < 5 {
            continue;
        }
        if idx == 0 && cols[0].eq_ignore_ascii_case("sku") {
            continue;
        }
        let sku = cols[0].trim().to_string();
        let name = cols[1].trim().to_string();
        if sku.is_empty() || name.is_empty() {
            continue;
        }
        let existing_stock: i64 = conn
            .query_row("SELECT stock_qty FROM products WHERE sku = ?1", params![sku], |r| r.get(0))
            .unwrap_or(0);
        let hlc1 = next_hlc(&conn, &cfg.node_id)?;
        let upsert = ProductUpsertPayload {
            sku: sku.clone(),
            name,
            barcode: cols.get(2).filter(|s| !s.is_empty()).cloned(),
            category: cols.get(3).filter(|s| !s.is_empty()).cloned().unwrap_or_else(|| "General".into()),
            brand: String::new(),
            variant: String::new(),
            warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
            sell_price_minor: parse_decimal_minor(cols.get(4).map(String::as_str).unwrap_or("0")),
            cost_price_minor: parse_decimal_minor(cols.get(5).map(String::as_str).unwrap_or("0")),
            low_stock_threshold: cols.get(7).and_then(|s| s.parse().ok()).unwrap_or(5),
        };
        pending_events.push(LedgerEvent {
            event_id: new_event_id(&hlc1),
            hlc: hlc1,
            node_id: cfg.node_id.clone(),
            event_type: "PRODUCT_UPSERT".to_string(),
            payload_json: serde_json::to_string(&upsert).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
        });
        let target_stock: i64 = cols.get(6).and_then(|s| s.parse().ok()).unwrap_or(0);
        let delta = target_stock - existing_stock;
        if delta != 0 {
            let hlc2 = next_hlc(&conn, &cfg.node_id)?;
            let adj = StockAdjustPayload { sku, delta, reason: "CSV Import".to_string() };
            pending_events.push(LedgerEvent {
                event_id: new_event_id(&hlc2),
                hlc: hlc2,
                node_id: cfg.node_id.clone(),
                event_type: "STOCK_ADJUST".to_string(),
                payload_json: serde_json::to_string(&adj).map_err(|e| e.to_string())?,
                synced_lan: 0,
                synced_relay: 0,
            });
        }
        count += 1;
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for ev in &pending_events {
        apply_ledger_event(&tx, ev)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}
