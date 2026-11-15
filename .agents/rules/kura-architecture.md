# Kura Global Engineering Invariants

> [!IMPORTANT]
> **Comprehensive Architectural Bible & AI Context**: Consult [docs/AI_CONTEXT_AND_DECISIONS.md](file:///f:/cool%20projects/Kura%20-%20Shop%20Stock%20%26%20Bill%20Sync/docs/AI_CONTEXT_AND_DECISIONS.md) whenever in-depth project history, architectural decision records (ADRs), full data models, or rationale behind technical choices is needed.

1. **Architecture**: Tauri v2 Hybrid. All stateful business logic, SQLite storage (`rusqlite`), AES-256-GCM Sync Chain encryption, LAN UDP/TCP peer sync, and ESC/POS byte generation live in Rust (`src-tauri/src/`). The frontend (`src/`) is strictly a featherlight Preact + Signals + Tailwind CSS v4 view layer.
2. **File Size Limit**: Keep every source file under 220 lines (strictly ≤ 215 lines locally).
3. **Immutable CRDT Ledger**: Never update inventory stock with mutable updates (`UPDATE products SET stock = ?` is forbidden). Stock is ALWAYS derived from the append-only `ledger_events` table (`STOCK_ADJUST`, `BILL_ISSUED`, `BILL_VOIDED`, `STOCK_PURCHASED`) maintained in sync with a materialized `products` projection cache inside a single SQLite ACID transaction.
4. **Integer Money Invariant**: Store all prices, costs, discounts, and totals as integer minor units (`i64` paisa/cents). Format to decimal strings only at the UI and receipt rendering boundary.
5. **Apple Cupertino HIG & OLED Dark Aesthetic**: Deterministic CSS Custom Properties (`--kura-bg-canvas`, `--kura-bg-card`, `--kura-text-primary`, `.kura-hero-cta`), `tabular-nums` on every number, and spring bottom sheets instead of center pop-up modals. Never use blanket dark overrides.
