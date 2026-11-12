---
name: kura-rust-core
description: Builds and maintains Kura's Tauri v2 Rust backend (src-tauri), Cargo.toml size optimizations, rusqlite WAL database connection pooling, and type-safe #[tauri::command] IPC handlers. Use whenever creating or modifying .rs files or Cargo.toml.
---

# Kura Rust Backend Protocol (Tauri v2)

## 1. Binary Size Optimization (`src-tauri/Cargo.toml`)
Always include this release profile to keep the Android `.so` and Windows `.exe` tiny:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

## 2. Core Crate Stack
Use only lean, battle-tested crates:
- `rusqlite = { version = "0.32", features = ["bundled"] }`
- `serde = { version = "1", features = ["derive"] }`
- `serde_json = "1"`
- `aes-gcm = "0.10"`
- `sha2 = "0.10"`
- `hkdf = "0.12"`
- `rand = "0.8"`
- `base64 = "0.22"`
- `tokio = { version = "1", features = ["net", "sync", "time", "rt-multi-thread", "macros"] }`

## 3. Database Concurrency & Error Handling
- Initialize SQLite with `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`.
- Wrap the `rusqlite::Connection` in a thread-safe `Mutex<Connection>` managed via `tauri::State`.
- Every `#[tauri::command]` must return `Result<T, String>` with descriptive error messages.
- Run `cargo check` inside `src-tauri` after every Rust file modification.
