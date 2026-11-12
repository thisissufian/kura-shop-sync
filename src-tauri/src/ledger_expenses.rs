use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};

use crate::ledger_customers::CustomerPaymentPayload;
use crate::models::{CashDrawerSummary, LedgerEvent, ShopExpense};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseLoggedPayload {
    pub expense_id: String,
    pub category: String,
    pub amount_minor: i64,
    pub note: String,
    pub node_id: String,
    pub hlc: String,
}

pub fn apply_expense_event(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    let e: ExpenseLoggedPayload =
        serde_json::from_str(&ev.payload_json).map_err(|err| format!("EXPENSE_LOGGED: {err}"))?;
    tx.execute(
        "INSERT OR IGNORE INTO expenses (expense_id, category, amount_minor, note, node_id, hlc)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![e.expense_id, e.category, e.amount_minor, e.note, e.node_id, e.hlc],
    )
    .map_err(|err| format!("Project EXPENSE_LOGGED: {err}"))?;
    Ok(())
}

fn sum_bills_by_mode(conn: &Connection, mode: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(SUM(total_minor), 0) FROM bills WHERE voided = 0 AND payment_mode = ?1",
        params![mode],
        |r| r.get(0),
    )
    .map_err(|e| format!("Sum {mode} bills: {e}"))
}

pub fn build_cash_drawer_summary(conn: &Connection) -> Result<CashDrawerSummary, String> {
    let cash_sales_minor = sum_bills_by_mode(conn, "CASH")?;
    let wallet_sales_minor = sum_bills_by_mode(conn, "WALLET")?;
    let due_issued_minor = sum_bills_by_mode(conn, "DUE")?;

    let mut khata_cash_collected_minor: i64 = 0;
    let mut pay_stmt = conn
        .prepare("SELECT payload_json FROM ledger_events WHERE event_type = 'CUSTOMER_PAYMENT'")
        .map_err(|e| format!("Prepare payments sum: {e}"))?;
    let pay_rows = pay_stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| format!("Query payments sum: {e}"))?;
    for row in pay_rows {
        let json = row.map_err(|e| e.to_string())?;
        if let Ok(p) = serde_json::from_str::<CustomerPaymentPayload>(&json) {
            khata_cash_collected_minor = khata_cash_collected_minor.saturating_add(p.amount_minor);
        }
    }

    let total_expenses_minor: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM expenses",
            [],
            |r| r.get(0),
        )
        .map_err(|e| format!("Sum expenses: {e}"))?;

    let mut exp_stmt = conn
        .prepare(
            "SELECT expense_id, category, amount_minor, note, node_id, hlc
             FROM expenses ORDER BY hlc DESC LIMIT 30",
        )
        .map_err(|e| format!("Prepare expenses: {e}"))?;
    let exp_rows = exp_stmt
        .query_map([], |r| {
            Ok(ShopExpense {
                expense_id: r.get(0)?,
                category: r.get(1)?,
                amount_minor: r.get(2)?,
                note: r.get(3)?,
                node_id: r.get(4)?,
                hlc: r.get(5)?,
            })
        })
        .map_err(|e| format!("Query expenses: {e}"))?;

    let mut recent_expenses = Vec::new();
    for item in exp_rows {
        recent_expenses.push(item.map_err(|e| e.to_string())?);
    }

    let expected_drawer_cash_minor = cash_sales_minor
        .saturating_add(khata_cash_collected_minor)
        .saturating_sub(total_expenses_minor);

    Ok(CashDrawerSummary {
        cash_sales_minor,
        wallet_sales_minor,
        due_issued_minor,
        khata_cash_collected_minor,
        total_expenses_minor,
        expected_drawer_cash_minor,
        recent_expenses,
    })
}
