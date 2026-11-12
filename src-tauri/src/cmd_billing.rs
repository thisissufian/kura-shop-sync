use rusqlite::params;
use tauri::State;

use crate::commands::AppState;
use crate::hlc::{new_event_id, next_hlc, next_invoice_number};
use crate::ledger::{apply_ledger_event, BillVoidPayload};
use crate::ledger_customers::get_customer_by_id;
use crate::ledger_queries::{get_bill_by_no, get_chain_config, list_recent_bills};
use crate::models::{BillItem, BillReceipt, IssueBillInput, LedgerEvent};

#[tauri::command]
pub fn issue_bill(
    input: IssueBillInput,
    state: State<'_, AppState>,
) -> Result<BillReceipt, String> {
    if input.items.is_empty() {
        return Err("Cart is empty".to_string());
    }
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let mut bill_items = Vec::with_capacity(input.items.len());
    let mut subtotal_minor: i64 = 0;

    for req in &input.items {
        if req.qty <= 0 {
            return Err("Item quantity must be positive".to_string());
        }
        let (name, sell_price_minor): (String, i64) = conn
            .query_row(
                "SELECT name, sell_price_minor FROM products WHERE sku = ?1",
                params![req.sku],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| format!("Product not found: {}", req.sku))?;
        let line_total_minor = sell_price_minor.saturating_mul(req.qty);
        subtotal_minor = subtotal_minor.saturating_add(line_total_minor);
        bill_items.push(BillItem {
            sku: req.sku.clone(),
            name,
            qty: req.qty,
            unit_price_minor: sell_price_minor,
            line_total_minor,
        });
    }

    let discount_minor = input.discount_minor.max(0).min(subtotal_minor);
    let total_minor = subtotal_minor.saturating_sub(discount_minor);
    let mode = if input.payment_mode.trim().is_empty() {
        "CASH".to_string()
    } else {
        input.payment_mode.trim().to_uppercase()
    };
    let customer_id = input.customer_id.filter(|s| !s.trim().is_empty());
    if mode == "DUE" {
        let cid = customer_id
            .as_deref()
            .ok_or_else(|| "Select or create a customer for Customer Due (Khata)".to_string())?;
        get_customer_by_id(&conn, cid)?;
    }

    let bill_no = next_invoice_number(&conn, &cfg.node_id)?;
    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let receipt = BillReceipt {
        bill_no,
        node_id: cfg.node_id.clone(),
        hlc: hlc.clone(),
        items: bill_items,
        discount_minor,
        total_minor,
        payment_mode: mode,
        customer_id,
        voided: false,
    };

    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "BILL_ISSUED".to_string(),
        payload_json: serde_json::to_string(&receipt).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(receipt)
}

#[tauri::command]
pub fn void_bill(bill_no: String, state: State<'_, AppState>) -> Result<BillReceipt, String> {
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can void bills".to_string());
    }
    let current = get_bill_by_no(&conn, &bill_no)?;
    if current.voided {
        return Err("Bill is already voided".to_string());
    }
    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "BILL_VOIDED".to_string(),
        payload_json: serde_json::to_string(&BillVoidPayload {
            bill_no: bill_no.clone(),
        })
        .map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;
    get_bill_by_no(&conn, &bill_no)
}

#[tauri::command]
pub fn get_recent_bills(state: State<'_, AppState>) -> Result<Vec<BillReceipt>, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    list_recent_bills(&conn, 50)
}

#[tauri::command]
pub fn find_bill_by_no(
    bill_no: String,
    state: State<'_, AppState>,
) -> Result<Option<BillReceipt>, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    Ok(get_bill_by_no(&conn, bill_no.trim()).ok())
}
