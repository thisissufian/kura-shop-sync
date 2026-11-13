use tauri::State;

use crate::commands::AppState;
use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::apply_ledger_event;
use crate::ledger_queries::get_chain_config;
use crate::ledger_suppliers::{
    get_supplier_by_id, list_suppliers, StockPurchasePayload, SupplierPaymentPayload,
};
use crate::models::{LedgerEvent, StockPurchaseInput, SupplierAccount};

#[tauri::command]
pub fn get_suppliers(state: State<'_, AppState>) -> Result<Vec<SupplierAccount>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    list_suppliers(&conn)
}

#[tauri::command]
pub fn record_stock_purchase(
    state: State<'_, AppState>,
    input: StockPurchaseInput,
) -> Result<SupplierAccount, String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can record supplier stock purchases".to_string());
    }

    let supplier_name = input.supplier_name.trim().to_string();
    if supplier_name.is_empty() {
        return Err("Supplier name cannot be empty".to_string());
    }
    if input.qty <= 0 {
        return Err("Purchase quantity must be positive".to_string());
    }
    if input.unit_cost_minor < 0 {
        return Err("Unit cost cannot be negative".to_string());
    }

    let supplier_id = match input.supplier_id {
        Some(ref sid) if !sid.trim().is_empty() => sid.trim().to_string(),
        _ => {
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM suppliers", [], |r| r.get(0))
                .unwrap_or(0);
            format!("{}-V{:04x}", cfg.node_id, count + 1)
        }
    };

    let total_cost_minor = input.unit_cost_minor.saturating_mul(input.qty);
    let due_minor = total_cost_minor.saturating_sub(input.paid_minor.max(0));
    let hlc = next_hlc(&mut conn, &cfg.node_id)?;
    let purchase_id = format!("PO-{}", new_event_id(&hlc));

    let payload = StockPurchasePayload {
        purchase_id,
        supplier_id: supplier_id.clone(),
        supplier_name,
        supplier_phone: input.supplier_phone.unwrap_or_default().trim().to_string(),
        sku: input.sku.trim().to_string(),
        qty: input.qty,
        unit_cost_minor: input.unit_cost_minor,
        paid_minor: input.paid_minor,
        due_minor,
        node_id: cfg.node_id.clone(),
        hlc: hlc.clone(),
    };

    let event = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "STOCK_PURCHASED".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &event)?;
    tx.commit().map_err(|e| e.to_string())?;

    get_supplier_by_id(&conn, &supplier_id)
}

#[tauri::command]
pub fn record_supplier_payment(
    state: State<'_, AppState>,
    supplier_id: String,
    amount_minor: i64,
    note: String,
) -> Result<SupplierAccount, String> {
    let mut conn = state.db.lock().map_err(|e| e.to_string())?;
    let cfg = get_chain_config(&conn)?;
    if cfg.role != "OWNER" {
        return Err("Only OWNER devices can record supplier payments".to_string());
    }

    if amount_minor <= 0 {
        return Err("Payment amount must be positive".to_string());
    }

    let sid = supplier_id.trim();
    if sid.is_empty() {
        return Err("Supplier ID is required".to_string());
    }

    let hlc = next_hlc(&mut conn, &cfg.node_id)?;
    let payment_id = format!("SP-{}", new_event_id(&hlc));

    let payload = SupplierPaymentPayload {
        payment_id,
        supplier_id: sid.to_string(),
        amount_minor,
        note: note.trim().to_string(),
        node_id: cfg.node_id.clone(),
        hlc: hlc.clone(),
    };

    let event = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "SUPPLIER_PAYMENT".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &event)?;
    tx.commit().map_err(|e| e.to_string())?;

    get_supplier_by_id(&conn, sid)
}
