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

## Owner Signatures on Secured Chains (S4)
- Fresh installs create an owner secret (`chain_config.owner_secret`) and public key (`owner_pk`); `src-tauri/src/owner_sig.rs`.
- Owner-only types (`OWNER_ONLY`): PRODUCT_UPSERT, BILL_VOIDED, STOCK_PURCHASED, SUPPLIER_PAYMENT, SHOP_SETTINGS_UPDATED. `apply_ledger_event` rejects them unless `sig` verifies against `owner_pk`. Rejected events go to `rejected_events` and still count in sync digests.
- **Events created on this device**: call `apply_local_event` (it signs). **Synced or backup events**: call `apply_ledger_event`; never sign them.
- Invites: `with_owner_params` (`pairing.rs`). Every invite gets `opk`; only owner invites get `osec`. Owner recovery phrase is 24 words (`mnemonic::owner_phrase`). Join and restore always overwrite both owner fields.
- `owner_pk = ''` means a legacy chain: unsigned events are accepted, the old behaviour. Upgrade: `chain_upgrade::secure_chain_db` moves to a new seed and signs history. Invites then carry `from` = `pairing::upgrade_proof(old_seed, new_seed)`, and a device on the old chain re-pairs via `migrate_join`, which keeps its data, drops unverifiable owner events and rebuilds. Never accept a bare chain id as `from`: ids are public. Tests that inject hand-made owner events use `tests_s4::init_unsecured_db`.
