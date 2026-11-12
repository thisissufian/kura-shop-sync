use tauri::State;

use crate::commands::AppState;
use crate::hlc::{new_event_id, next_hlc};
use crate::ledger::apply_ledger_event;
use crate::ledger_expenses::{build_cash_drawer_summary, ExpenseLoggedPayload};
use crate::ledger_queries::get_chain_config;
use crate::models::{CashDrawerSummary, LedgerEvent, ShopExpense};

#[tauri::command]
pub fn log_shop_expense(
    category: String,
    amount_minor: i64,
    note: String,
    state: State<'_, AppState>,
) -> Result<ShopExpense, String> {
    let cat = category.trim();
    if cat.is_empty() {
        return Err("Expense category is required".to_string());
    }
    if amount_minor <= 0 {
        return Err("Expense amount must be positive".to_string());
    }
    let mut conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    let cfg = get_chain_config(&conn)?;
    let hlc = next_hlc(&conn, &cfg.node_id)?;
    let expense_id = format!("EXP-{}", new_event_id(&hlc));
    let payload = ExpenseLoggedPayload {
        expense_id: expense_id.clone(),
        category: cat.to_string(),
        amount_minor,
        note: note.trim().to_string(),
        node_id: cfg.node_id.clone(),
        hlc: hlc.clone(),
    };
    let ev = LedgerEvent {
        event_id: new_event_id(&hlc),
        hlc: hlc.clone(),
        node_id: cfg.node_id.clone(),
        event_type: "EXPENSE_LOGGED".to_string(),
        payload_json: serde_json::to_string(&payload).map_err(|e| e.to_string())?,
        synced_lan: 0,
        synced_relay: 0,
    };
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_ledger_event(&tx, &ev)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(ShopExpense {
        expense_id,
        category: payload.category,
        amount_minor,
        note: payload.note,
        node_id: cfg.node_id,
        hlc,
    })
}

#[tauri::command]
pub fn get_cash_drawer_summary(state: State<'_, AppState>) -> Result<CashDrawerSummary, String> {
    let conn = state.db.lock().map_err(|_| "DB lock failed".to_string())?;
    build_cash_drawer_summary(&conn)
}
