# Kura (蔵) Global Engineering Invariants

1. **Architecture**: Tauri v2 Hybrid. All stateful business logic, SQLite storage (`rusqlite`), AES-256-GCM Sync Chain encryption, LAN UDP/TCP peer sync, and ESC/POS byte generation live in Rust (`src-tauri/src/`). The frontend (`src/`) is strictly a featherlight Preact + Signals + Tailwind CSS v4 view layer.
2. **File Size Limit**: Keep every source file under 220 lines.
3. **Immutable CRDT Ledger**: Never update inventory stock with `UPDATE products SET stock = stock - ?`. Stock is ALWAYS derived from the append-only `ledger_events` table (`STOCK_ADJUST`, `BILL_ISSUED`, `BILL_VOIDED`) maintained in sync with a materialized `products_projection` cache inside a single SQLite ACID transaction.
4. **Integer Money Invariant**: Store all prices, costs, discounts, and totals as integer minor units (`i64` paisa/cents). Format to decimal strings only at the UI and receipt rendering boundary.
5. **Apple Cupertino HIG Aesthetic**: `#F5F5F7` canvas, `#FFFFFF` squircle cards (`rounded-[14px]`, `border border-black/[0.06]`), `tabular-nums` on every number, and spring bottom sheets instead of center pop-up modals.
