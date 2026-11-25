---
name: kura-testing
description: Conventions and patterns for writing and running Kura's Rust regression tests and TypeScript checks. Use when adding tests in src-tauri/src/tests*.rs, testing Tauri command logic, or running verification commands.
---

# Kura Testing & Verification Protocol

## 1. Where Tests Live & Size Limit
- Place Rust tests in `src-tauri/src/tests*.rs`. If a file would exceed 220 lines (keep `<= 215`), create `src-tauri/src/tests_<task>.rs` and register `#[cfg(test)] mod tests_<task>;` in `src-tauri/src/lib.rs`.
- Test Tauri commands without `tauri::State` by extracting core logic into plain functions taking `&Connection` or `&mut Connection` (pattern in `src-tauri/src/cmd_config_vault.rs` and `src-tauri/src/cmd_billing.rs`).

## 2. Database & Event Test Setup
- Create isolated temp DBs via `std::env::temp_dir().join(...)` + `init_db(&path)` from `crate::ledger_init::init_db`, removing the temp path/dir at the end (see `src-tauri/src/tests.rs` and `src-tauri/src/tests_t3.rs`).
- Insert ledger events in tests by constructing `LedgerEvent` and calling `crate::ledger::apply_ledger_event(&tx, &ev)` inside `conn.transaction()`, then `tx.commit()` (see `ev(...)` in `src-tauri/src/tests.rs` and `make_ev(...)` in `src-tauri/src/tests_print_csv.rs`).
- For old-DB migration tests, open a SQLite file directly with `rusqlite::Connection::open(&path)` using the pre-migration schema, close it, then open with `init_db(&path)`.

## 3. Commands & Fail-Before / Pass-After Loop
The workspace folder contains `&`, so never use `npx`. Run:
- Rust tests & compile check (from `src-tauri/`): `cargo test` and `cargo check`
- Frontend type check (from repo root): `node ./node_modules/typescript/bin/tsc --noEmit`

Always write the regression test first, run `cargo test` to observe the test fail before the fix, apply the fix, and re-run `cargo test`, `cargo check`, and `tsc --noEmit` after the final edit.
