---
name: escpos-pdf-print
description: Builds Kura's wireless thermal receipt engine (58mm and 80mm ESC/POS byte encoder over TCP port 9100 and Bluetooth) and zero-dependency native vector PDF invoice generator. Use when working on receipts, printing, or PDF export.
---

# Kura Thermal ESC/POS & Vector PDF Engine

## 1. Pure Rust ESC/POS Byte Encoder (`src-tauri/src/printer/escpos.rs`)
Build raw byte vectors (`Vec<u8>`) with zero external heavy dependencies:
- Init: `[0x1B, 0x40]`
- Align Left/Center/Right: `[0x1B, 0x61, 0 | 1 | 2]`
- Bold On/Off: `[0x1B, 0x45, 1]` / `[0x1B, 0x45, 0]`
- Double Height/Width: `[0x1D, 0x21, 0x11]` / Normal: `[0x1D, 0x21, 0x00]`
- Cut Paper (with feed): `[0x1D, 0x56, 0x42, 0x00]`
- **58mm Layout**: 32 columns per line (`Item: 16 chars | Qty: 4 chars | Total: 12 chars`).
- **80mm Layout**: 48 columns per line (`Item: 26 chars | Qty: 6 chars | Total: 16 chars`).
- **Network Dispatch**: Stream bytes via `tokio::net::TcpStream` to `<printer_ip>:9100` with a 3-second timeout, or chunk into 180-byte MTU slices for Bluetooth LE thermal printers.

## 2. Zero-Dependency Vector PDF Generator (`src-tauri/src/printer/pdf_gen.rs`)
Write a clean, pure-Rust minimal PDF 1.4 document writer using built-in Type1 `Courier` / `Helvetica` fonts (no external font embedding bloat). Generates a crisp, thermal-proportioned `.pdf` receipt file in under 8 KB on disk so the user can print via OS print dialog or share directly to WhatsApp.
