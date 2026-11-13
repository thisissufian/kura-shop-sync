# Contributing to Kura (蔵)

Thank you for your interest in contributing to **Kura (蔵)** — an ultra-lightweight, offline-first Shop Stock, POS & Multi-Phone Bill Sync operating system built with Tauri v2 (Rust Native Core) and Preact + Signals + Tailwind CSS v4.

---

## 1. Core Architectural Invariants

Every contribution must strictly adhere to these 4 engineering invariants:

1. **220-Line Source Code Ceiling**:
   - No single `.rs`, `.ts`, or `.tsx` file in `src/` or `src-tauri/src/` may exceed **220 lines**.
   - If a feature or component grows beyond 200 lines, extract a focused sub-module or child component immediately.
2. **Zero-Bloat Mandate (<50 KB Frontend Bundle)**:
   - The total gzipped production bundle (`dist/`) must remain **under 50 KB**.
   - Do NOT install heavy third-party UI libraries (MUI, Radix, Chakra), heavy PDF rasterizers, or large barcode/crypto libraries. Kura uses native Web APIs (`BarcodeDetector`, `AudioContext`, CSS variables) and native Rust engines.
3. **Integer Money Invariant**:
   - All currency values across Rust, SQLite (`INTEGER`), and TypeScript (`number`) must be stored and calculated as **integer minor units** (`i64` paisa/cents, e.g. `14950` = `149.50`).
   - Never use floating-point math for money. Formatting to decimals occurs strictly at display boundaries.
4. **Append-Only CRDT Ledger**:
   - Never overwrite mutable inventory stock directly (`UPDATE products SET stock_qty = ?` is forbidden).
   - Stock changes must stem from append-only, commutative `ledger_events` (`STOCK_ADJUST`, `BILL_ISSUED`, `BILL_VOIDED`).

---

## 2. Local Development Workflow

### Prerequisites
- **Node.js** `>= 20` & `npm`
- **Rust** stable toolchain (`cargo`, `rustc`)
- Tauri v2 system prerequisites (C++ Build Tools / WebView2 on Windows, WebKitGTK on Linux)

### Commands
```bash
# 1. Install frontend dependencies
npm install

# 2. Run Desktop POS in Development Mode
npm run tauri dev

# 3. Or run fast Browser-Only Preview
npm run dev

# 4. Verify Frontend Bundle Size & Typecheck
npm run build

# 5. Run Rust Unit & Integration Tests (7/7 tests)
cd src-tauri && cargo test && cargo check
```

---

## 3. Pull Request Guidelines

1. Ensure all 7 Rust unit/integration tests pass with zero warnings.
2. Verify that `npm run build` succeeds and `dist/` total gzipped size is `< 50 KB`.
3. Verify that no modified or newly added `.rs`, `.ts`, or `.tsx` file exceeds 220 lines.
4. Write clear, semantic commit messages (e.g. `feat(...)`, `fix(...)`, `perf(...)`).
