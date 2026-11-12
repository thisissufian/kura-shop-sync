---
name: kura-ledger-crdt
description: Implements Kura's conflict-free append-only inventory ledger, Hybrid Logical Clock (HLC) event ordering, collision-free node invoice numbering, and atomic stock projection in SQLite. Use when working on products, stock adjustments, billing, or offline event merging.
---

# Kura Conflict-Free Ledger & Stock Engine

## 1. Hybrid Logical Clock (HLC)
Every event carries an HLC string formatted as: `{ISO8601_ms}-{4DigitCounter}-{NodeID}` (e.g., `2026-11-12T15:04:05.123Z-0001-K1`).
When receiving remote events from another phone, update the local HLC clock so causal ordering is strictly preserved even if a phone's wall clock drifts.

## 2. Deterministic Node Invoice Numbers
Each phone in the sync chain has a unique short `node_id` (`K1`, `K2`, `K3`...).
Every bill generated on node `K1` gets a collision-free invoice number:
`{node_id}-{YYMMDD}-{4DigitDailySeq}` (e.g., `K1-261112-0001`).

## 3. SQLite Schema & Atomic Projection
Maintain three core tables in `kura.db`:
1. `chain_config`: Stores `node_id`, `shop_name`, `currency_symbol`, `role` (`OWNER` | `CASHIER`), `encrypted_seed`, and `last_hlc`.
2. `ledger_events`: Immutable append-only log (`event_id TEXT PRIMARY KEY`, `hlc TEXT NOT NULL`, `node_id TEXT NOT NULL`, `event_type TEXT NOT NULL`, `payload_json TEXT NOT NULL`, `synced_lan INTEGER DEFAULT 0`, `synced_relay INTEGER DEFAULT 0`).
3. `products`: Materialized view table (`sku TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `barcode TEXT`, `category TEXT`, `sell_price_minor INTEGER NOT NULL`, `cost_price_minor INTEGER NOT NULL`, `stock_qty INTEGER NOT NULL DEFAULT 0`, `low_stock_threshold INTEGER NOT NULL DEFAULT 5`, `updated_hlc TEXT NOT NULL`).

Whenever a `PRODUCT_UPSERT`, `STOCK_ADJUST`, `BILL_ISSUED`, or `BILL_VOIDED` event is inserted into `ledger_events` (either locally or via Sync Chain merge), atomically apply its delta to `products` inside the same SQLite transaction (`INSERT OR IGNORE INTO ledger_events...` -> only apply delta if `changes() > 0`). This guarantees 100% idempotency when two phones sync duplicate packets.
