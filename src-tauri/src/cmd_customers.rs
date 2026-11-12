use rand::RngCore;
use tauri::State;

use crate::commands::AppState;
use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::apply_ledger_event;
use crate::ledger_customers::{
    get_customer_by_id, list_customers, CustomerPaymentPayload, CustomerUpsertPayload,
};
use crate::ledger_queries::get_chain_config;
use crate::models::{CustomerAccount, LedgerEvent};

#[tauri::command]
pub fn get_customers(state: State<'_, AppState>) -> Result<Vec<CustomerAccount>, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    list_customers(&conn)
}

#[tauri::command]
pub fn upsert_customer(
    customer_id: Option<String>,
    name: String,
    phone: String,
    state: State<'_, AppState>,
) -> Result<CustomerAccount, String> {
    let clean_name = name.trim().to_string();
    let clean_phone = phone.trim().to_string();
    if clean_name.is_empty() || clean_phone.is_empty() {
        return Err("Customer name and phone are required".to_string());
    }

    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let cid = match customer_id.filter(|s| !s.trim().is_empty()) {
        Some(id) => id.trim().to_string(),
        None => {
            let mut b = [0u8; 3];
            rand::rngs::OsRng.fill_bytes(&mut b);
            format!("{}-C{:02X}{:02X}{:02X}", cfg.node_id, b[0], b[1], b[2])
        }
    };

    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let payload = CustomerUpsertPayload {
        customer_id: cid.clone(),
        name: clean_name,
        phone: clean_phone,
    };
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "CUSTOMER_UPSERT".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;
    get_customer_by_id(&conn, &cid)
}

#[tauri::command]
pub fn record_customer_payment(
    customer_id: String,
    amount_minor: i64,
    note: String,
    state: State<'_, AppState>,
) -> Result<CustomerAccount, String> {
    if amount_minor <= 0 {
        return Err("Payment amount must be greater than zero".to_string());
    }
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    get_customer_by_id(&conn, &customer_id)?;
    let cfg = get_chain_config(&conn)?;
    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let payment_id = new_event_id(&hlc);
    let payload = CustomerPaymentPayload {
        payment_id,
        customer_id: customer_id.clone(),
        amount_minor,
        note: note.trim().to_string(),
    };
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc,
        node_id: cfg.node_id,
        event_type: "CUSTOMER_PAYMENT".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;
    get_customer_by_id(&conn, &customer_id)
}
