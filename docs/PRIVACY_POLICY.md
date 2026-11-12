# Privacy Policy for Kura (蔵) — Offline Shop Stock & Bill Sync

**Effective Date:** November 12, 2026  
**Developer:** Kura Offline POS Project

## 1. Overview
**Kura (蔵)** ("the App") is an offline-first Point-of-Sale, inventory management, and billing application. We believe merchant sales ledgers, product cost prices, and customer phone numbers belong strictly to the shop owner. Kura does **not** operate any developer-hosted user accounts, analytics servers, crash telemetry trackers, or advertising SDKs.

## 2. Data Stored Locally on Your Device
All operational shop data created inside Kura is stored strictly inside a local SQLite database on your device's internal application storage:
- Product catalog metadata (SKUs, names, barcodes, categories, prices, and stock quantities)
- Issued receipts, void records, and petty cash expense logs
- Customer credit (Khata) names, phone numbers, and due balances
- Cryptographic Sync Chain keys (128-bit sync seed and device role)

## 3. Permissions Used & Why
- **Camera (`android.permission.CAMERA`)**: Used exclusively on-device when you open the built-in Barcode/QR Scanner to look up SKUs, scan receipt barcodes, or pair another shop phone via QR code. No camera frames or photos are ever recorded, stored, or uploaded.
- **Local Network / Wi-Fi (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`)**: Used solely for:
  1. Automatic peer discovery and AES-256-GCM encrypted synchronization between paired shop phones on your local Wi-Fi/Hotspot (UDP port `42851` / TCP port `42850`).
  2. Streaming ESC/POS receipt print jobs directly to your local wireless thermal printer (TCP port `9100`).
  3. Optional user-configured public WebSocket relay syncing, where every payload is encrypted client-side with **AES-256-GCM** using your 128-bit Sync Chain seed before leaving your device.
- **Storage / Downloads Export**: Used only when you explicitly tap to export receipt PDFs, A4 barcode sticker PDFs, catalog CSVs, or encrypted `.kura` vault backups.

## 4. Third-Party Sharing & WhatsApp Receipts
Kura never transmits your data to third-party brokers or advertisers. When you tap **"WhatsApp Share"** on a receipt, the App opens your chosen WhatsApp client with the formatted receipt text so you can review and send it manually to your customer.

## 5. Data Retention & Deletion
Because no developer cloud server holds your shop data, you are in full control of retention:
- Uninstalling Kura deletes the local SQLite database unless you have manually exported a `.kura` encrypted vault backup or CSV file.
- Keep your 12-word recovery phrase safe; lost recovery phrases cannot be reset by any developer or support team because no central servers exist.

## 6. Contact
If you have questions regarding this Privacy Policy or Kura's security architecture, please open an issue on the project repository or contact the developer via the support email listed on the Google Play Store page.
