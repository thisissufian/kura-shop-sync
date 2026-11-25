use rusqlite::Connection;
use std::path::PathBuf;

use crate::cmd_config_vault::save_shop_settings_conn;
use crate::hlc::{hlc_local_date, next_invoice_number_at, parse_iso_ms};
use crate::ledger::apply_ledger_event;
use crate::ledger_analytics::compute_owner_analytics_at;
use crate::ledger_expenses::ExpenseLoggedPayload;
use crate::ledger_init::init_db;
use crate::ledger_queries::get_chain_config;
use crate::models::{BillItem, BillReceipt, LedgerEvent, ShopSettingsInput};

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("kura_t4_{}_{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir.join("kura.db")
}

#[test]
fn test_shop_local_day_boundary_dhaka_rollover() {
    let path = temp_db("dhaka_day");
    let mut conn = init_db(&path).unwrap();

    // 2026-11-24T20:00:00Z is 2026-11-25 02:00 in Bangladesh (UTC+6, default offset = 360)
    let bill_hlc = "2026-11-24T20:00:00Z-0001-K1";
    let bill = BillReceipt {
        bill_no: "K1-261125-0001".into(),
        node_id: "K1".into(),
        hlc: bill_hlc.into(),
        items: vec![BillItem {
            sku: "SKU-101".into(),
            name: "Artisan Cold Brew 250ml".into(),
            qty: 1,
            unit_price_minor: 35000,
            unit_cost_minor: Some(18000),
            line_total_minor: 35000,
            warranty_label: "No Warranty (ওয়ারেন্টি নেই)".into(),
        }],
        discount_minor: 0,
        total_minor: 35000,
        payment_mode: "CASH".into(),
        customer_id: None,
        client_label: "Walk-in Customer".into(),
        cashier_label: "Owner · K1".into(),
        voided: false,
    };
    let exp = ExpenseLoggedPayload {
        expense_id: "EXP-T4".into(),
        category: "Supplies".into(),
        amount_minor: 5000,
        note: "Night delivery".into(),
        node_id: "K1".into(),
        hlc: "2026-11-24T20:10:00.000Z-0001-K1".into(),
    };
    let tx = conn.transaction().unwrap();
    apply_ledger_event(
        &tx,
        &LedgerEvent {
            event_id: "ev-t4-b1".into(),
            hlc: bill_hlc.into(),
            node_id: "K1".into(),
            event_type: "BILL_ISSUED".into(),
            payload_json: serde_json::to_string(&bill).unwrap(),
            synced_lan: 0,
            synced_relay: 0,
        },
    )
    .unwrap();
    apply_ledger_event(
        &tx,
        &LedgerEvent {
            event_id: "ev-t4-e1".into(),
            hlc: exp.hlc.clone(),
            node_id: "K1".into(),
            event_type: "EXPENSE_LOGGED".into(),
            payload_json: serde_json::to_string(&exp).unwrap(),
            synced_lan: 0,
            synced_relay: 0,
        },
    )
    .unwrap();
    tx.commit().unwrap();

    // At 2026-11-24T20:30:00Z (2026-11-25 02:30 in Dhaka), invoice sequence uses 261125
    let now_night_utc = parse_iso_ms("2026-11-24T20:30:00.000Z").unwrap();
    let inv = next_invoice_number_at(&conn, "K1", now_night_utc).unwrap();
    assert_eq!(inv, "K1-261125-0002", "Invoice prefix must use shop-local date 261125");

    // At 2026-11-25T05:00:00Z (2026-11-25 11:00 in Dhaka), the 20:00Z bill & expense count in TODAY (2026-11-25)
    let now_morning_utc = parse_iso_ms("2026-11-25T05:00:00.000Z").unwrap();
    let a = compute_owner_analytics_at(&conn, "TODAY", now_morning_utc).unwrap();
    assert_eq!(a.gross_revenue_minor, 35000, "2026-11-24T20:00Z bill must count as 2026-11-25");
    assert_eq!(a.operating_expenses_minor, 5000, "2026-11-24T20:10Z expense must count as 2026-11-25");
    assert_eq!(a.daily_trend.last().unwrap().date_label, "11/25");
    assert_eq!(a.daily_trend.last().unwrap().revenue_minor, 35000);
    assert_eq!(hlc_local_date(bill_hlc, 360).as_deref(), Some("2026-11-25"));
    assert_eq!(hlc_local_date(bill_hlc, 0).as_deref(), Some("2026-11-24"));

    // Switching offset to 0 (UTC) makes 2026-11-24T20:00:00Z fall outside TODAY at 2026-11-25T05:00Z
    save_shop_settings_conn(
        &mut conn,
        ShopSettingsInput {
            shop_name: "Kura General Store".into(),
            shop_subtitle: "UTC".into(),
            currency_symbol: "$".into(),
            receipt_footer: "Thanks".into(),
            utc_offset_minutes: 0,
        },
    )
    .unwrap();
    let a_utc = compute_owner_analytics_at(&conn, "TODAY", now_morning_utc).unwrap();
    assert_eq!(a_utc.gross_revenue_minor, 0);
    assert_eq!(next_invoice_number_at(&conn, "K1", now_night_utc).unwrap(), "K1-261124-0001");

    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}

#[test]
fn test_old_db_migration_and_negative_offset_settings() {
    let path = temp_db("old_schema");
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    {
        let old = Connection::open(&path).unwrap();
        old.execute_batch(
            "CREATE TABLE chain_config (
               id INTEGER PRIMARY KEY CHECK (id = 1),
               node_id TEXT NOT NULL, shop_name TEXT NOT NULL, currency_symbol TEXT NOT NULL,
               role TEXT NOT NULL, seed_b64 TEXT NOT NULL, last_hlc TEXT NOT NULL, is_linked INTEGER NOT NULL DEFAULT 0
             );
             INSERT INTO chain_config (id, node_id, shop_name, currency_symbol, role, seed_b64, last_hlc, is_linked)
             VALUES (1, 'K1', 'Old Shop', '$', 'OWNER', 'AAECAwQFBgcICQoLDA0ODw', '', 0);",
        )
        .unwrap();
    }

    let mut conn = init_db(&path).unwrap();
    assert_eq!(get_chain_config(&conn).unwrap().utc_offset_minutes, 360);

    // Legacy SHOP_SETTINGS_UPDATED event without utc_offset_minutes still parses cleanly
    let tx = conn.transaction().unwrap();
    apply_ledger_event(
        &tx,
        &LedgerEvent {
            event_id: "ev-legacy-settings".into(),
            hlc: "2026-11-24T12:00:00.000Z-0001-K1".into(),
            node_id: "K1".into(),
            event_type: "SHOP_SETTINGS_UPDATED".into(),
            payload_json: r#"{"shop_name":"Old Shop 2","shop_subtitle":"","currency_symbol":"৳","receipt_footer":"Hi"}"#.into(),
            synced_lan: 0,
            synced_relay: 0,
        },
    )
    .unwrap();
    tx.commit().unwrap();
    assert_eq!(get_chain_config(&conn).unwrap().utc_offset_minutes, 360);

    // Negative offset (-300 = UTC-5): 2026-11-25T03:00:00Z is 2026-11-24 22:00 local
    let saved = save_shop_settings_conn(
        &mut conn,
        ShopSettingsInput {
            shop_name: "NY Mart".into(),
            shop_subtitle: "NYC".into(),
            currency_symbol: "$".into(),
            receipt_footer: "Thanks".into(),
            utc_offset_minutes: -300,
        },
    )
    .unwrap();
    assert_eq!(saved.utc_offset_minutes, -300);
    assert_eq!(hlc_local_date("2026-11-25T03:00:00Z", -300).as_deref(), Some("2026-11-24"));

    let _ = std::fs::remove_dir_all(path.parent().unwrap());
}
