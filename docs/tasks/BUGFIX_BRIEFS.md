# Kura Bug-Fix Briefs (for Antigravity agents)

Each task is self-contained. Run ONE task per Antigravity conversation, then stop.
Do them in the order listed. After each, commit on its own branch `fix/<task-id>`.

## Rules for every task
- Follow `.agents/rules/kura-architecture.md` (≤220 lines per file, never `UPDATE products SET stock_qty = ?`, all money is `i64` minor units).
- Folder name contains `&`: never use `npx`. Use `node ./node_modules/typescript/bin/tsc --noEmit` and `cargo test` from `src-tauri/`.
- Add a regression test for the bug (Rust tests live in `src-tauri/src/tests*.rs`; add a new `tests_<task>.rs` if a file would pass 220 lines, and register it in `lib.rs` under `#[cfg(test)]`).
- Done = new test fails before the fix, passes after; full `cargo test` and `tsc` green; no unrelated edits.
- Old databases must still open: add columns with the existing `let _ = conn.execute("ALTER TABLE ...")` pattern in `ledger_init.rs`; new serde fields need `#[serde(default)]` so old events still parse.

## Ship every task (T3 onward)
1. **Start from the latest GitHub main:**
   `git checkout main` → `git pull --no-rebase origin main` → `git checkout -b fix/<task-id>`.
   If the previous task's `fix/*` PR is not merged yet (`gh pr list --repo thisissufian/kura-shop-sync --state open`), STOP and tell the owner; do not stack branches. Open `docs/*` PRs do not block.
2. **Commit** with the message `fix(<area>): <what> (<task-id>)`.
3. **Push the branch:** `git push -u origin fix/<task-id>`.
4. **Open a PR:** `gh pr create --repo thisissufian/kura-shop-sync --base main --head fix/<task-id> --title "<commit subject>" --body "<what was wrong, what changed, tests added, cargo test / tsc results>"`.
5. **Never** merge the PR, push to `main`, force-push, or delete branches. The owner reviews and merges.
6. Finish by reporting the PR URL and test counts, then stop.

## Skills: use them, and create one when it pays off
Skills live in `.agents/skills/<name>/SKILL.md`. Existing: `kura-rust-core`, `kura-ledger-crdt`, `kura-sync-chain`, `escpos-pdf-print`, `apple-hig-ui`, `camera-scanner-audio`.
1. **Before coding**, read every existing skill whose description matches the files you will touch.
2. **Create a new skill only if both are true:**
   - the knowledge will help **at least two** upcoming tasks in this file (T-tasks or S-items), and
   - it isn't already covered by an existing skill or `.agents/rules/kura-architecture.md`.
   If an existing skill almost covers it, **add a short section to that skill** instead of creating a new one.
   Good candidates: `kura-migrations` (the `ALTER TABLE` + `#[serde(default)]` pattern used by T3, T4, T6) and `kura-testing` (the in-memory DB test setup, the `make_ev` helper, fail-before/pass-after steps).
   Not worth a skill: details of one bug, anything only this task needs.
3. **Format:**
   - Frontmatter has `name` (kebab-case) and `description` (what it does + "Use when …").
   - The body is at most 80 lines.
   - Write only concrete content: real file paths, exact commands, and code patterns copied from this repo, each citing its source file. No generic advice and nothing you didn't verify in the code.
4. **Shipping:**
   - Commit the skill separately as `docs(skills): add <name>` (or `update <name>`) on the same task branch.
   - List it under a "Skills" heading in the PR body, with one line on which future tasks it helps.
5. Never edit `.agents/rules/` or this briefs file unless the task says so.

## Report honestly
- If the brief is wrong (the bug doesn't reproduce, or the fix changes nothing), do **not** make the change. Say so in the PR body and in your final report, then stop.
- Your final report must list every commit in `git log main..HEAD`. Don't describe files as excluded or untouched without checking `git status`.

---

## T1 — Vault restore wipes the key on failure  · model: Gemini (Medium)
File: `src-tauri/src/cmd_config_vault.rs` → `import_encrypted_vault`.
Bug: with a recovery phrase, it writes `seed_b64` and `role='OWNER'` to `chain_config` BEFORE decrypting. A wrong phrase/file fails decryption but the device has already lost its real seed.
Fix: derive the seed, decode + decrypt + parse the snapshot first; only then, inside ONE transaction, update seed/role/shop profile and apply the events.
Test: call the core logic with a wrong phrase → error returned AND `chain_config.seed_b64` unchanged. (Extract the logic into a plain fn taking `&mut Connection` so it is testable without Tauri `State`.)

## T2 — Small correctness fixes  · model: Gemini (Medium)
1. `src-tauri/src/crypto_chain.rs` `url_decode`: condition `i + 2 < bytes.len()` skips an escape at the very end of the string; change it to `i + 3 <= bytes.len()`. Test: `url_decode("Caf%C3%A9") == "Café"`.
2. `src-tauri/src/hlc.rs` `next_hlc` / `observe_remote_hlc`: counter is clamped with `.min(9999)` which produces duplicate HLCs. When the counter would exceed 9999, advance the ISO timestamp by 1 ms and reset the counter to 0. Test: set `last_hlc` to a future ISO with counter 9999, call `next_hlc` twice → strictly increasing, distinct.

## T3 — Historical profit changes when cost changes  · model: Gemini (High)
Files: `models.rs` (`BillItem`), `cmd_billing.rs` (`issue_bill`), `ledger_analytics.rs`, `ledger_analytics_trend.rs` if it uses cost, frontend `src/types/kura.ts`, `src/state/previewAnalytics.ts`.
Bug: COGS uses the product's CURRENT `cost_price_minor`, so every restock rewrites past P&L.
Fix: add `#[serde(default)] pub unit_cost_minor: Option<i64>` to `BillItem`; fill it from `products.cost_price_minor` in `issue_bill`. Analytics uses `item.unit_cost_minor` and falls back to the current cost only when `None` (old bills). Cashier views must still not see cost (check `get_recent_bills` / `find_bill_by_no` redact `unit_cost_minor` for non-OWNER roles).
Test: issue bill at cost 600, then STOCK_PURCHASED at cost 900 → P&L COGS still uses 600.

## T4 — Shop-local day boundaries  · model: Gemini (High)
Files: `ledger_init.rs` (new column `utc_offset_minutes INTEGER NOT NULL DEFAULT 360` on `chain_config`), `ledger.rs` `ShopSettingsPayload` (`#[serde(default = ...)]` field), `cmd_config_vault.rs` settings get/update, `hlc.rs` `next_invoice_number`, `ledger_analytics.rs`, `ledger_analytics_trend.rs`, `src/ui/sheets/ShopSettingsSheet.tsx`, `src/types/kura.ts`.
Bug: "Today", 7-day trend and the daily invoice sequence all roll over at UTC midnight (06:00 in Bangladesh).
Fix: keep HLCs in UTC; shift `now` and each bill/expense timestamp by the offset only when computing the calendar day. Add an offset picker to Shop Settings.
Test: bill at `2026-11-24T20:00:00Z` with offset 360 counts as 2026-11-25.

## T5 — Joining a chain doubles starter stock  · model: Gemini (High)
Files: `cmd_sync_print.rs` `join_sync_chain`, `ledger_init.rs`.
Bug: every fresh install seeds 5 starter products as its own events (random IDs). After joining, they sync to the owner and stock doubles (SKU-101: 24 → 48).
Fix: in `join_sync_chain`, inside one transaction, delete all local rows from `ledger_events, products, bills, customers, suppliers, expenses` and reset `last_hlc` BEFORE saving the new seed and syncing. Only do this when the device is not yet linked (`is_linked = 0`); if already linked, return an error asking the user to confirm a reset (add a `force_reset: Option<bool>` arg and a confirm prompt in the UI join flow, `src/ui/components/QrPairingCard.tsx`).
Test: fresh DB A and fresh DB B (both seeded), "join" B → B has 0 events; then apply A's events to B → stock equals A's.

## T6 — Duplicate node IDs make bills overwrite each other  · model: Claude Opus 4.6 (Thinking) in Antigravity
Files: `commands.rs` `build_sync_status`, `cmd_sync_print.rs` `join_sync_chain`, `crypto_chain.rs` `parse_pairing_uri`, `ledger_init.rs`.
Bug: every owner invite hands out node `K2`, every cashier `K3`, and every fresh install is `K1`. Two cashiers both create bill `K3-YYMMDD-0001`; `INSERT OR IGNORE INTO bills` drops the second one and its stock is never deducted.
Fix: the JOINING device generates its own node ID: `K` + 4 random uppercase base32 chars (e.g. `K7QF2`) at join time; ignore the `node` param from the URI (keep parsing it for backward compatibility). Fresh installs also generate a random ID instead of `K1`. Keep the `K` prefix so labels still look like terminals. Update `node_id` only before any local events exist (T5 guarantees this).
Test: two joins with the same cashier URI produce different node IDs; bills from both survive a merge.

---

## Design work (done with Claude Code)
Status: all five shipped. S2+S3 in PR #8, S1 in #9, S4 in #10, S5 in #11. Details are in each PR and in the `kura-ledger-crdt` / `kura-sync-chain` skills.
Open follow-ups: upgrading chains created before S4 (needs re-pairing every device); cashiers can still read all synced data, costs included, because they hold the seed.
- **S1 Sync sends only events newer than the peer's clock** (`lan_peer.rs`, `remoteRelay.ts`): offline bills older than the peer's latest HLC never sync. Needs a per-node version vector exchange.
- **S2 Out-of-order events lost** (`ledger.rs`, `ledger_customers.rs`, `ledger_suppliers.rs`): void before bill, payment before customer → silently dropped.
- **S3 Product/customer "last write wins" corrupted** by stock/bill events bumping `updated_hlc`.
- **S4 Cashier → Owner escalation** (`crypto_chain.rs`): `auth` is optional and derived from a seed cashiers already hold.
- **S5 Relay protocol** (`remoteRelay.ts`): raw JSON is rejected by Nostr relays.
