# Google Play Store Launch Kit — Kura (蔵)

## 1. Store Listing Copy (ASO-Ready)

### App Name (Max 30 chars)
`Kura — Offline Shop POS & Sync` (30 chars)

### Short Description (Max 80 chars)
`Offline shop inventory, khata due ledger, thermal bills & multi-phone sync.` (76 chars)

### Full Description (Up to 4000 chars)
**Kura (蔵)** is an ultra-lightweight, zero-subscription, offline-first Point-of-Sale (POS), Inventory Vault, Customer Credit (Khata) Ledger, and Thermal/PDF Billing app built for independent retail stores, kirana shops, pharmacies, cafes, and market stalls.

Unlike bloated cloud POS apps that lock your shop behind monthly fees, slow dashboards, and mandatory logins, **Kura runs 100% locally on your device** in a native Rust + SQLite engine and syncs directly across your shop's phones with end-to-end **AES-256-GCM encryption** — zero accounts, zero tracking, zero server lock-in.

#### Key Features Built for Real Retail Counters
- **1-Handed Counter & Hold Queue (`F6`)**: Tap items, scan barcodes, apply integer-accurate discounts, park up to 5 active customer carts while serving the next shopper, and ring up receipts in under 2 seconds.
- **Multi-Phone Sync Chain (Brave-Style)**: Pair Owner and Cashier devices via QR code or a 12-word encrypted recovery phrase. Sync automatically over local shop Wi-Fi / Hotspot (UDP discovery + TCP delta streaming) or bridge distant Owner phones live via end-to-end encrypted WebSocket relays.
- **Role-Based Terminal Isolation**: Link Cashier phones with `CASHIER` permissions (billing, stock top-up, and Khata collection) while keeping catalog editing, cost prices, net profit analytics, shop settings, and bill voiding locked exclusively to `OWNER` devices.
- **Conflict-Free CRDT Inventory Ledger**: Two phones selling the exact same product while offline never overwrite each other's stock counts. Every sale, restock, void, customer payment, and petty expense is recorded as an immutable Hybrid Logical Clock (HLC) ledger event.
- **Customer Credit ("Khata" / Due) Ledger**: Issue `Cash`, `Wallet / QR`, or `Customer Due` bills cleanly, track total receivables across all devices, and record partial or full customer settlements in 1 tap.
- **Cash Drawer & Petty Expense Reconciliation**: Real-time till math (`Cash Sales + Khata Cash Collected − Petty Expenses`) with quick expense categories (`Supplies`, `Utility / Rent`, `Tea / Staff`, `Transport`, `Supplier Payout`).
- **Wireless ESC/POS Thermal Printing & Vector PDFs**: Stream crisp 58mm or 80mm thermal receipts directly over TCP port `9100`, export compact vector PDF receipts embedded with a scannable Code-39 bill barcode for instant 1-second return lookups, share formatted bills via WhatsApp in 1 tap, and generate printable A4 3×8 barcode sticker sheets.
- **Zero-Bloat Camera & Hardware Barcode Scanner**: Uses native `BarcodeDetector` camera scanning with crisp WebAudio POS chimes — or plug in any USB/Bluetooth HID barcode gun (`<35ms` burst detection).
- **Bulk CSV & `.kura` Encrypted Vault Backups**: Import/export your full product catalog via standard CSV or save/restore full encrypted `.kura` ledger snapshots.

#### Why Shopkeepers Trust Kura
- **Zero Subscriptions**: No per-register fees, no cloud lock-in.
- **100% Private**: Your pricing, margins, customer phone numbers, and sales never touch an unencrypted server.
- **Tiny Footprint**: Minimal battery, storage, and RAM usage even on budget Android phones.

---

## 2. Feature Graphic & Screenshot Copy Prompts

- **Feature Graphic (1024 × 500 px)**:
  - Headline: `Kura (蔵) — Offline POS & Multi-Phone Sync`
  - Subhead: `Zero Cloud Fees · Thermal & PDF Bills · Khata & Till Sync`
- **Screenshot 1 (Counter)**: *1-Handed POS Counter · Hold Carts & Scan in 1 Tap*
- **Screenshot 2 (Customer Due / Khata)**: *Instant Customer Credit (Khata) & 1-Tap Settlement*
- **Screenshot 3 (Cash Drawer)**: *Live Physical Cash Drawer & Petty Expense Reconciliation*
- **Screenshot 4 (Sync Chain)**: *Pair Cashier & Owner Phones via QR Over Local Wi-Fi*
- **Screenshot 5 (Receipts)**: *58mm/80mm Thermal Printing, Vector PDF & WhatsApp Bills*

---

## 3. Android Release Build Instructions (APK / AAB)

### Prerequisites
- Rust toolchain + Android targets:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
  ```
- Android Studio with **Android SDK Platform 34+**, **NDK (Side-by-side)**, and **Java 17 JDK**.
- Set `ANDROID_HOME` and `NDK_HOME` environment variables.

### Initialize & Build Release AAB (Google Play)
```bash
# 1. Initialize Tauri Android Gradle project (one-time)
npx tauri android init

# 2. Inject LAN multicast, printer cleartext HTTP & camera/BT permissions
npm run android:prep

# 3. Verify frontend bundle stays under 50 KB gzipped
npm run build

# 4. Build signed Android App Bundle (.aab) and release APK
npx tauri android build --aab --apk
```

### Cloud Builds via GitHub Actions
Push a version tag (e.g. `git tag v0.1.0 && git push origin v0.1.0`) or click **Actions -> Kura Release & Cross-Platform Cloud Builder -> Run workflow** on GitHub to build `.apk` and `.aab` files in the cloud and download the **`kura-android-playstore-bundle`** artifact directly.

### Signing Configuration (`keystore.properties`)
Create a release upload keystore once using `keytool`:
```bash
keytool -genkey -v -keystore kura-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kura
```
Place `keystore.properties` in `src-tauri/gen/android/` before uploading the generated `.aab` under `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/` to Google Play Console.
