use rusqlite::{params, Connection, Transaction};
use serde::{Deserialize, Serialize};

use crate::models::{CustomerAccount, LedgerEvent};

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerUpsertPayload {
    pub customer_id: String,
    pub name: String,
    pub phone: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerPaymentPayload {
    pub payment_id: String,
    pub customer_id: String,
    pub amount_minor: i64,
    pub note: String,
}

pub fn apply_customer_event(tx: &Transaction, ev: &LedgerEvent) -> Result<(), String> {
    match ev.event_type.as_str() {
        "CUSTOMER_UPSERT" => {
            let c: CustomerUpsertPayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("CUSTOMER_UPSERT: {e}"))?;
            tx.execute(
                "INSERT INTO customers (customer_id, name, phone, balance_due_minor, updated_hlc)
                 VALUES (?1, ?2, ?3, 0, ?4)
                 ON CONFLICT(customer_id) DO UPDATE SET
                   name = excluded.name,
                   phone = excluded.phone,
                   updated_hlc = excluded.updated_hlc
                 WHERE customers.updated_hlc <= excluded.updated_hlc",
                params![c.customer_id, c.name, c.phone, ev.hlc],
            )
            .map_err(|e| format!("Project CUSTOMER_UPSERT: {e}"))?;
        }
        "CUSTOMER_PAYMENT" => {
            let p: CustomerPaymentPayload = serde_json::from_str(&ev.payload_json)
                .map_err(|e| format!("CUSTOMER_PAYMENT: {e}"))?;
            tx.execute(
                "UPDATE customers
                 SET balance_due_minor = balance_due_minor - ?1, updated_hlc = ?2
                 WHERE customer_id = ?3",
                params![p.amount_minor, ev.hlc, p.customer_id],
            )
            .map_err(|e| format!("Project CUSTOMER_PAYMENT: {e}"))?;
        }
        _ => {}
    }
    Ok(())
}

pub fn list_customers(conn: &Connection) -> Result<Vec<CustomerAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT customer_id, name, phone, balance_due_minor, updated_hlc
             FROM customers
             ORDER BY balance_due_minor DESC, name ASC",
        )
        .map_err(|e| format!("Prepare customers: {e}"))?;
    let rows = stmt
        .query_map([], |r| {
            Ok(CustomerAccount {
                customer_id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                balance_due_minor: r.get(3)?,
                updated_hlc: r.get(4)?,
            })
        })
        .map_err(|e| format!("Query customers: {e}"))?;

    let mut out = Vec::new();
    for c in rows {
        out.push(c.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn get_customer_by_id(
    conn: &Connection,
    customer_id: &str,
) -> Result<CustomerAccount, String> {
    conn.query_row(
        "SELECT customer_id, name, phone, balance_due_minor, updated_hlc
         FROM customers WHERE customer_id = ?1",
        params![customer_id],
        |r| {
            Ok(CustomerAccount {
                customer_id: r.get(0)?,
                name: r.get(1)?,
                phone: r.get(2)?,
                balance_due_minor: r.get(3)?,
                updated_hlc: r.get(4)?,
            })
        },
    )
    .map_err(|_| format!("Customer not found: {customer_id}"))
}
