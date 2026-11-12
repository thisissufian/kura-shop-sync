---
name: kura-sync-chain
description: Implements the Brave-style multi-phone Sync Chain, HKDF/AES-256-GCM encryption, Owner vs Cashier QR pairing payloads, local LAN UDP/TCP automatic peer sync, and remote live sales broadcast. Use for networking, QR pairing, and multi-device sync tasks.
---

# Kura Sync Chain ("Brave Sync" for Retail)

## 1. Cryptographic Hierarchy
- **Chain Master Seed**: 16 random bytes (128-bit) encoded both as a human-readable 12-word recovery code and compact `base64url`.
- **Key Derivation (HKDF-SHA256)**:
  - `sync_aes_key` (32 bytes): Derived with info `"kura-sync-aes-256-gcm"`. Encrypts all `ledger_events` sent over LAN or remote relays using 96-bit random nonces.
  - `owner_auth_token` (32 bytes): Derived with info `"kura-owner-role-verify"`.

## 2. Role-Based QR Pairing URI
Generate QR codes encoding:
`kura://join?seed=<base64url>&role=<OWNER|CASHIER>&node=<K2>&shop=<urlEncodedShopName>&lan=<ip:port>`
- If `role=CASHIER`, the joining phone locks out cost prices, net profit dashboards, and bill deletion in both the UI and local command guards.

## 3. Dual Zero-Cost Transport
- **Local Shop LAN (Zero Internet)**: Run a background Tokio task in Rust listening on TCP port `42850` and broadcasting a lightweight UDP discovery beacon on port `42851` every 3 seconds containing `{ chain_id_hash, node_id, latest_hlc, tcp_port }`. When two phones on the same Wi-Fi or mobile hotspot detect a matching `chain_id_hash` with a different `latest_hlc`, they connect over TCP and exchange missing encrypted `ledger_events` in under 50ms.
- **Remote Live Relay (Owner at Home)**: Provide a configurable WebSocket relay client that publishes and subscribes to AES-256-GCM encrypted event envelopes keyed by `chain_id_hash` so the Owner phone receives live sales updates remotely at $0 server cost.
