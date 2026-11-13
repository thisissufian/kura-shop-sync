# Security Policy for Kura (蔵)

## 1. Local-First Threat Model

**Kura (蔵)** operates on a **zero-account, local-first** architecture. There are no developer-hosted central databases, analytics trackers, or user identity clouds.

- **Data Storage**: All shop ledgers, catalog items, customer balances, and pricing records reside in a local SQLite database in Write-Ahead Logging (WAL) mode on your device's internal application storage.
- **Role Isolation**:
  - `OWNER` devices hold full administrative privileges: catalog editing, wholesale cost visibility, profit analytics, shop settings, and bill voiding.
  - `CASHIER` devices can only create bills, record stock arrivals, and collect Khata dues. Wholesale cost prices and profit margins are automatically redacted (`0`) in Rust before IPC delivery.

---

## 2. Cryptographic Sync Chain Protocol

Synchronization between shop devices (over local LAN UDP/TCP or public WebSocket relays) is secured via end-to-end encryption:

1. **Master Seed**: 128-bit CSPRNG entropy generated locally using OS random sources (`OsRng`).
2. **Key Derivation (HKDF-SHA256)**:
   - `AES-256-GCM Key`: Derived via HKDF-SHA256 with info `kura-sync-aes-256-gcm`.
   - `Owner Verification Token`: Derived with info `kura-owner-role-verify`.
   - `Public Relay Chain Hash`: SHA-256 digest of `kura-chain-id || seed`.
3. **Packet Encryption**: Every network payload and `.kura` backup archive is encrypted with **AES-256-GCM** using a unique 96-bit (12-byte) random nonce per transmission.
4. **Zero-Knowledge Relays**: Public WebSocket relays only see the 8-byte public chain hash and ciphertext. They have zero visibility into shop names, SKUs, sales, prices, or customer identities.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability in Kura's cryptography, IPC boundary, or local database handling:

1. Please do **NOT** open a public GitHub issue.
2. Send an email with reproduction steps and proof-of-concept to the maintainer via GitHub profile contact or private security advisory.
3. Vulnerabilities will be triaged and addressed with an immediate patch and security advisory release.
