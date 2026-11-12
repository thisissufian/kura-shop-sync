use rusqlite::params;
use tauri::State;

use crate::commands::{build_sync_status, AppState};
use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::{apply_ledger_event, ProductUpsertPayload, StockAdjustPayload};
use crate::ledger_customers::list_customers;
use crate::ledger_queries::{get_chain_config, list_products, list_recent_bills};
use crate::models::{BootstrapState, LedgerEvent, Product, UpsertProductInput};

#[tauri::command]
pub fn get_bootstrap_state(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let redact = cfg.role != "OWNER";
    Ok(BootstrapState {
        products: list_products(&conn, redact)?,
        recent_bills: list_recent_bills(&conn, 50)?,
        customers: list_customers(&conn)?,
        sync_status: build_sync_status(&conn, &state.lan)?,
    })
}

#[tauri::command]
pub fn upsert_product(
    input: UpsertProductInput,
    state: State<'_, AppState>,
) -> Result<Product, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Cashier role cannot create or edit catalog/cost prices".to_string());
    }
    let sku = input.sku.trim().to_string();
    if sku.is_empty() || input.name.trim().is_empty() {
        return Err("SKU and product name are required".to_string());
    }
    let existed: Option<i64> = conn
        .query_row(
            "SELECT stock_qty FROM products WHERE sku = ?1",
            params![sku],
            |r| r.get(0),
        )
        .ok();
    let hlc1 = next_hlc(&conn, &cfg.node_id)?;
    let upsert = ProductUpsertPayload {
        sku: sku.clone(),
        name: input.name.trim().to_string(),
        barcode: input.barcode.filter(|b| !b.trim().is_empty()),
        category: if input.category.trim().is_empty() {
            "General".to_string()
        } else {
            input.category.trim().to_string()
        },
        sell_price_minor: input.sell_price_minor.max(0),
        cost_price_minor: input.cost_price_minor.max(0),
        low_stock_threshold: input.low_stock_threshold.max(0),
    };
    let ev1 = LedgerEvent {
        event_id: new_event_id(&hlc1),
        hlc: hlc1,
        node_id: cfg.node_id.clone(),
        event_type: "PRODUCT_UPSERT".to_string(),
        payload_json: serde_json::to_string(&upsert).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };

    let delta = input.stock_qty - existed.unwrap_or(0);
    let ev2 = if delta != 0 {
        let hlc2 = next_hlc(&conn, &cfg.node_id)?;
        let adj = StockAdjustPayload {
            sku: sku.clone(),
            delta,
            reason: if existed.is_none() {
                "Opening Stock"
            } else {
                "Catalog Edit"
            }
            .to_string(),
        };
        Some(LedgerEvent {
            event_id: new_event_id(&hlc2),
            hlc: hlc2,
            node_id: cfg.node_id.clone(),
            event_type: "STOCK_ADJUST".to_string(),
            payload_json: serde_json::to_string(&adj).map_err(|e| e.to_string())?,
            synced_lan: 0,
            synced_relay: 0,
        })
    } else {
        None
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev1)?;
    if let Some(ref e2) = ev2 {
        apply_ledger_event(&tx, e2)?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    list_products(&conn, false)?
        .into_iter()
        .find(|p| p.sku == sku)
        .ok_or_else(|| "Product saved but not found".to_string())
}

#[tauri::command]
pub fn adjust_stock(
    sku: String,
    delta: i64,
    reason: String,
    state: State<'_, AppState>,
) -> Result<Product, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "STOCK_ADJUST".to_string(),
        payload_json: serde_json::to_string(&StockAdjustPayload {
            sku: sku.clone(),
            delta,
            reason,
        })
        .map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;

    list_products(&conn, cfg.role != "OWNER")?
        .into_iter()
        .find(|p| p.sku == sku)
        .ok_or_else(|| format!("Unknown SKU: {sku}"))
}
