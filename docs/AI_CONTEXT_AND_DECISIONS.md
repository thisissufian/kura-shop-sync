# Kura — AI Memory, Architectural Decisions & Conversation History Bible

> **Document Classification**: Core Project Memory, Architectural Decision Records (ADRs) & Engineering History  
> **Target Audience**: AI Agents (Gemini, Claude, GPT), Lead Systems Architects, and Open-Source Maintainers  
> **Canonical Path**: `docs/AI_CONTEXT_AND_DECISIONS.md`  
> **Last Updated**: November 2026 — Release v1.0.0

---

## 1. Project Origin & Product Vision

### 1.1 The Market Failure of Modern Point-of-Sale Software
Retail counter software in 2026 is fundamentally broken for independent storekeepers, kirana shops, gadget kiosks, and micro-retailers. Commercial POS software is dominated by two extractive paradigms:
1. **The Cloud SaaS Extortion Model** (e.g., Loyverse, Square, Lightspeed, Shopify POS):
   - Stores are forced into mandatory cloud logins, monthly per-register fees (\$29–\$89/month/register), and high merchant-processing fees.
   - If the store's broadband Wi-Fi drops, the registers freeze or drop offline orders, causing catastrophic double-sales.
   - Store financial data (turnover, customer names, wholesale costs, margins) is harvested on centralized third-party servers.
2. **The Bloated Hybrid / Electron Monster**:
   - Desktop and tablet POS apps regularly consume 150 MB–450 MB of disk space and over 1 GB of RAM just to render a basic numeric keypad.
   - Flutter and React Native APKs exceed 35 MB–60 MB, with 4–8 second cold boots that fail on entry-level Android devices (e.g., 2 GB RAM Helio G35 phones).

### 1.2 The Kura Manifesto
**Kura** was engineered to prove that a flagship retail counter operating system can be:
- **Zero-Cloud & Zero-Subscription**: Scalable to 10,000+ independent retail shops without incurring a single dollar in developer database or server hosting bills.
- **Ultra-Lightweight**: Production frontend compiled into **`<58 KB` gzipped** (HTML + CSS + JS) with sub-`200ms` boot times and minimal RAM usage.
- **Multi-Phone Autonomous Sync**: Cashiers and owners running Android phones and Windows PCs sync seamlessly over local Wi-Fi without relying on a remote cloud backend.
- **Pure Privacy**: Merchant ledgers, supplier wholesale costs, customer credit (*Khata*) debts, and receipts remain strictly on-device in an encrypted, ACID-compliant SQLite WAL vault.

### 1.3 Brand Naming Evolution
During initial architectural phases, generic and corporate POS names were evaluated and systematically discarded:
- *LumaPOS / NexoPOS*: Rejected as generic SaaS clichés that blend into existing low-quality Play Store apps.
- *Mise (Mise en Place)*: Rejected due to culinary-specific connotations that did not translate well to electronics and retail merchants.
- *Kura (蔵)*: Chosen for its heritage. In traditional Japanese merchant architecture, a **Kura** is an earthen-walled, fireproof, disaster-resilient storehouse built to safeguard a family business's most valuable inventory and accounting ledgers.
- **Pure "Kura" Rebrand**: In Milestone 7 (Release v1.0.0), the Kanji suffix `(蔵)` was cleanly removed from all titles, UI headers, receipts, website copy, and metadata to establish a clean, global Apple-style product identity (**Kura — Shop Stock & Bill Sync**).

---

## 2. Chronological Conversation & Milestone Ledger (Milestones 1 to 6)

### Milestone 1 (Phases 1–5): Native Foundation & Cryptographic Mesh Core
- **Agent Environment Setup**: Established `.agents/rules/kura-architecture.md` and 5 specialized skills (`kura-rust-core`, `kura-ledger-crdt`, `kura-sync-chain`, `apple-hig-ui`, `escpos-pdf-print`).
- **Tauri v2 Hybrid Architecture**: Scaffolded Tauri v2 with a compiled Rust native core and a featherlight Preact + Signals + Tailwind CSS v4 frontend.
- **Event-Sourced SQLite WAL**: Replaced flat tables with an append-only `ledger_events` table ordered by Hybrid Logical Clocks (HLC). Monotonic clock drift mitigation implemented in Rust.
- **Brave-Style Sync Chain**: Implemented 128-bit CSPRNG master seed with 12-word BIP-39 mnemonic recovery. HKDF-SHA256 derives 256-bit symmetric AES-256-GCM keys and owner verification tokens.
- **Local LAN Discovery & Wire Protocol**: Broadcast UDP discovery on port `42851` and encrypted TCP streaming on port `42850`.
- **Zero-Dependency ESC/POS & PDF 1.4**: Implemented pure-Rust byte encoder for 58mm (32-column) and 80mm (48-column) thermal printers over TCP `9100`, plus raw vector PDF 1.4 byte generator.
- **Result**: Gzipped frontend bundle: **`34.36 KB`** across 41 source files.

### Milestone 2 (Phases 6–10): Camera Scanner, WebAudio & Cloudless Backup
- **Hardware & Camera Scanning**: Built `ScannerSheet.tsx` using the native browser `BarcodeDetector` API for EAN-13, EAN-8, UPC, Code-128, and QR codes.
- **0-KB Tactile WebAudio Synthesizer**: Replaced audio asset files with Web Audio API `OscillatorNode` synthesis (`playScanBeep`: 1800 Hz, `playCheckoutChime`: Apple Pay-style two-tone 523 Hz -> 784 Hz, `playWarningTone`: 220 Hz sawtooth).
- **Dynamic Multi-Currency**: Added shop currency configuration (`৳` BDT, `$` USD, `€` EUR, `₹` INR, `¥` JPY) with graceful ASCII fallback on ESC/POS thermal printers.
- **Ephemeral WebSocket Relay**: Enabled live sales broadcast across distant shop counters via public WebSocket relays with zero-knowledge AES-256-GCM encryption.
- **Encrypted `.kura` Vault Backup**: Built binary snapshot exporter/importer (`.kura`) encrypted with the store's 12-word master key.
- **Result**: Gzipped frontend bundle: **`39.75 KB`** across 48 source files.

### Milestone 3 (Phases 11–15): Customer Khata, Barcode Stickers & HID Gun Listener
- **Customer Due (*Khata*) Ledger**: Implemented `customers` table with `CUSTOMER_UPSERT` and `CUSTOMER_PAYMENT` ledger events. Added payment modes: `Cash`, `Wallet / QR`, and `Customer Due`.
- **Vector Code-39 Barcode Sticker Sheet**: Pure-Rust A4 PDF sticker sheet generator (3x8 grid, 24 labels per page) with Code-39 barcode rasterization, price formatting, and shop name header.
- **Bulk CSV Catalog Engine**: Full CSV import/export parsing SKUs, barcodes, categories, retail prices, wholesale cost prices, and stock counts.
- **Hardware Barcode Gun Listener**: Burst-detection keyboard listener intercepting rapid key events (`<35ms` delta) with automatic enter suppression and fast cart addition.
- **Bespoke Apple Squircle Icon**: SVG brand mark inspired by storehouse architecture and gold coin lock vaults.
- **Result**: Gzipped frontend bundle: **`43.15 KB`** across 55 source files.

### Milestone 4 (Phases 16–20): Parked Carts, Till Math & WhatsApp Receipts
- **Parked / Held Cart Queue (`F6`)**: Multi-customer holding bar allowing cashiers to park up to 5 incomplete carts while checking out walk-in customers.
- **Instant Bill Lookup by Barcode**: Scanner and hardware gun listener automatically match invoice barcode patterns (`^K\d+-\d{6}-\d{4}$`) to pull up previous receipts for reprint, return, or voiding.
- **Cash Drawer & Petty Expense Till**: Real-time physical cash reconciliation formula:
  $$\text{Expected Drawer Cash} = \text{Cash Sales} + \text{Khata Cash Collected} - \text{Petty Expenses}$$
- **1-Tap WhatsApp Receipts**: Generated clean, human-readable UTF-8 digital receipt text for instant customer dispatch via WhatsApp web/mobile links.
- **Cargo Windows Hard-Link Fix**: Resolved `os error 1142` on Windows drives by setting `incremental = false` and disabling debug strip on dev builds in `Cargo.toml`.
- **Comprehensive Test Suite & Play Store Kit**: Added 10/10 automated Rust tests, Play Store ASO kit (`docs/PLAY_STORE_LISTING.md`), and Privacy Policy (`docs/PRIVACY_POLICY.md`).
- **Result**: Gzipped frontend bundle: **`46.54 KB`** across 64 source files.

### Milestone 5 & Market Reference Upgrade: Executive P&L & Supplier Payables
- **Competitive Market Analysis**: Conducted deep architectural study of benchmark gadget store POS (*Device N Gear*). Adopted best commercial features while rejecting flawed UX patterns:
  - *Adopted*: Executive Turnover Hero Card, 4-button quick action grid, Full P&L Statement with `Today`/`7D`/`30D`/`Yearly` filters, Inventory Valuation (Cost vs. Retail), Supplier Payables (*Vendor Dues*), bilingual warranty tags, and inline `Cost | Margin` badges.
  - *Rejected & Fixed*: Removed the confusing floating `+` FAB that overlapped the bottom checkout bar; eliminated redundant duplicate KPI cards; replaced single-phone storage with multi-phone Rust CRDT sync.
- **Supplier Payables & Restock Ledger**: Added `suppliers` table and `STOCK_PURCHASED` / `SUPPLIER_PAYMENT` events to track vendor credit and inventory restocks.
- **Bilingual Warranty System**: Embedded warranty labels (`No Warranty (ওয়ারেন্টি নেই)`, `7 Days Replacement`, `6 Months`, `1 Year Official`) into thermal and PDF receipt generation.
- **5-Tab Cupertino Glass Dock**: Restructured navigation into `Counter`, `Dashboard`, `Vault`, `Reports`, and `Sync & Print`.
- **Result**: Gzipped frontend bundle: **`54.72 KB`** across 74 source files.

### Milestone 6 & Visual Refinement: Open Source, Showcase Site & Contrast Tokens
- **`SupportingSofts/` Toolchain Audit**: Added local SDK integration scripts (`scripts/use-supporting-softs.ps1`) and protected Git from large binary installers via `.gitignore`.
- **Open-Source Transition**: Applied MIT License, `CONTRIBUTING.md`, and `SECURITY.md`.
- **Apple.com Minimalist Showcase Website (`website/`)**: Built an Apple-inspired product landing page featuring an embedded live POS iframe, keynote typography, and responsive bento grid.
- **Semantic CSS Token Architecture**: Completely eliminated blanket `.bg-white` and `.text-white` dark overrides. Replaced with strict CSS custom properties (`--kura-bg-canvas`, `--kura-bg-card`, `--kura-text-primary`, `.kura-hero-cta`).
- **Simulator Dynamic Island Clearance**: Added a dedicated 36px `.ios-status-bar` row (`9:41`, Dynamic Island, status SVGs) above the showcase POS iframe to eliminate header overlap.
- **BDT Financial Realism**: Replaced starter negative mock data with realistic store metrics (`৳ 2,860.00` revenue, `৳ 1,405.00` COGS, `৳ 120.00` expenses, `+৳ 1,335.00` net operating profit).
- **Result**: Gzipped frontend bundle: **`57.23 KB`** across 75 source files.

---

## 3. Architectural Decision Records (ADRs)

### ADR-01: Tauri v2 Hybrid vs. Electron, Capacitor, or Pure GPUI
- **Context**: Choosing the runtime shell for an ultra-lightweight retail POS running across Windows counters and Android cashier phones.
- **Alternatives Considered**:
  1. *Electron*: Excluded immediately due to massive RAM usage (500 MB+ idle), 150 MB package size, and lack of mobile Android support.
  2. *Capacitor / Pure Web*: Excluded because web browsers cannot bind raw UDP multicast sockets (`42851`), open raw TCP listener streams (`42850`), or stream raw ESC/POS bytes to TCP port `9100`.
  3. *Pure Rust GPUI / Slint / Iced*: Excluded due to slow UI prototyping, poor international font fallback on mobile, and complex soft-keyboard and camera scanner integration on Android.
- **Decision**: **Tauri v2 (Rust Native Core + Preact/Signals WebView)**.
- **Consequences**: Native performance, instant raw socket and hardware access, combined with zero-bloat reactive UI iteration.

### ADR-02: Zero-Server-Bill P2P Sync Architecture
- **Context**: Enabling multiple shop phones (Owner + multiple Cashiers) to share inventory and bills without incurring cloud database bills.
- **Decision**: Multi-tier peer-to-peer sync:
  1. *Tier 1 (LAN UDP/TCP)*: Devices multicast heartbeats on UDP `42851` and exchange encrypted HLC event deltas on TCP `42850`.
  2. *Tier 2 (Ephemeral WebSocket Relay)*: Optional internet sync via Nostr/WebSocket relays transmitting AES-256-GCM ciphertext without storing plaintext.
  3. *Tier 3 (Physical `.kura` Vault)*: Full snapshot export/import for air-gapped device migration.
- **Consequences**: Zero recurring infrastructure costs. The software operates indefinitely even if external cloud providers experience outages.

### ADR-03: Append-Only Event-Sourced CRDT SQLite Ledger
- **Context**: Traditional POS apps perform mutable updates (`UPDATE products SET stock = stock - 1`). If two cashiers ring up the last item while disconnected, reconciling the database causes split-brain data corruption.
- **Decision**: All business operations are recorded as immutable, append-only `ledger_events` stamped with Hybrid Logical Clocks:
  $$\text{HLC} = (\text{timestamp\_ms}, \text{logical\_counter}, \text{node\_id})$$
- **Consequences**: Concurrent sales converge deterministically on every node via state-based CRDT replay. Stock count is a deterministic projection of all historical events.

### ADR-04: 64-Bit Integer Minor Units (`i64`) for Currency
- **Context**: IEEE-754 floating-point numbers (`0.1 + 0.2 = 0.30000000000000004`) introduce rounding discrepancies in discounts, taxes, and valuation calculations.
- **Decision**: All monetary calculations across Rust, SQLite (`INTEGER`), and TypeScript (`number`) are executed in **integer minor units** (paisa/cents).
  - `৳ 1,495.50` is stored and computed strictly as `149550`.
  - Formatting to decimal strings occurs strictly at display and print boundaries.
- **Consequences**: Zero rounding drift across P&L, stock valuation, and tax ledgers.

### ADR-05: Strict 220-Line File Ceiling & Antigravity Brain Modules
- **Context**: Large monolith source files (>500 lines) cause context truncation and hallucinations during AI agent code generation.
- **Decision**: Strict enforcement of a **220-line ceiling** across every `.rs`, `.ts`, and `.tsx` file in `src/` and `src-tauri/src/`. Large views and command modules must be split into focused sub-components.
- **Consequences**: High-fidelity AI code generation with deterministic compilation and clear single-responsibility modules.

---

## 4. Complete Data Model & Event-Sourcing Invariants

### 4.1 SQLite Schema (`src-tauri/src/ledger_init.rs`)

```sql
-- 1. Cryptographic Sync Chain Configuration
CREATE TABLE IF NOT EXISTS chain_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seed_hex TEXT NOT NULL,
  recovery_phrase TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'CASHIER')),
  shop_name TEXT NOT NULL,
  shop_subtitle TEXT,
  currency_symbol TEXT NOT NULL DEFAULT '৳',
  receipt_footer TEXT NOT NULL DEFAULT 'Thank you for shopping!',
  created_at TEXT NOT NULL
);

-- 2. Append-Only CRDT Ledger Events
CREATE TABLE IF NOT EXISTS ledger_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  hlc TEXT NOT NULL,
  node_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 3. Materialized Projections (ACID Cached Tables)
CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  variant TEXT,
  warranty_label TEXT,
  sell_price_minor INTEGER NOT NULL,
  cost_price_minor INTEGER NOT NULL,
  stock_qty INTEGER NOT NULL,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bills (
  bill_no TEXT PRIMARY KEY,
  hlc TEXT NOT NULL,
  node_id TEXT NOT NULL,
  items_json TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  discount_minor INTEGER NOT NULL,
  total_minor INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'WALLET', 'DUE')),
  customer_id TEXT,
  client_label TEXT,
  cashier_label TEXT,
  voided INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  balance_due_minor INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  payable_balance_minor INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  expense_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  note TEXT,
  node_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 4.2 The 10 Canonical Ledger Events

| Event Type | Payload Fields | State Transition Applied |
| :--- | :--- | :--- |
| `PRODUCT_UPSERT` | `sku`, `name`, `barcode`, `category`, `brand`, `variant`, `warranty_label`, `sell_price_minor`, `cost_price_minor`, `stock_qty`, `low_stock_threshold` | Upserts product record and adjusts baseline stock count. |
| `STOCK_ADJUST` | `sku`, `delta_qty`, `reason` | Adjusts `products.stock_qty += delta_qty`. |
| `STOCK_PURCHASED`| `supplier_id`, `sku`, `qty`, `unit_cost_minor`, `paid_minor` | Restocks `products.stock_qty += qty` and updates `suppliers.payable_balance_minor += (qty * unit_cost - paid)`. |
| `BILL_ISSUED` | `bill_no`, `items`, `total_minor`, `discount_minor`, `payment_mode`, `customer_id` | Deducts line item quantities from stock; if `DUE`, increments customer balance. |
| `BILL_VOIDED` | `bill_no` | Marks bill as voided; restores item quantities back to `products.stock_qty`. |
| `CUSTOMER_UPSERT`| `customer_id`, `name`, `phone` | Registers or updates customer khata profile. |
| `CUSTOMER_PAYMENT`| `customer_id`, `amount_minor`, `note` | Decrements `customers.balance_due_minor -= amount_minor`. |
| `SUPPLIER_PAYMENT`| `supplier_id`, `amount_minor`, `note` | Decrements `suppliers.payable_balance_minor -= amount_minor`. |
| `EXPENSE_LOGGED` | `expense_id`, `category`, `amount_minor`, `note` | Appends petty cash expense and deducts from physical cash till. |
| `SHOP_SETTINGS_UPDATED` | `shop_name`, `shop_subtitle`, `currency_symbol`, `receipt_footer` | Synchronizes shop branding metadata across all terminals. |

### 4.3 Mathematical Formulas & Integrity Guarantees

#### 1. Inventory Stock Count Projection
$$\text{Stock}(sku) = \text{InitQty} + \sum \Delta \text{Adjust} + \sum \text{Purchased} - \sum \text{Billed}_{\text{valid}} + \sum \text{Voided}$$

#### 2. Net Operating Profit & P&L Statement
$$\text{Gross Revenue} = \sum_{\text{valid bills}} \text{total\_minor}$$
$$\text{Cost of Goods Sold (COGS)} = \sum_{\text{valid bills}} \left( \sum_{\text{item}} \text{qty} \times \text{cost\_price\_minor} \right)$$
$$\text{Gross Profit} = \text{Gross Revenue} - \text{COGS}$$
$$\text{Net Operating Profit} = \text{Gross Profit} - \sum \text{Expenses}$$

#### 3. Expected Physical Cash in Drawer
$$\text{Physical Till} = \text{Cash Sales} + \text{Khata Cash Collected} - \text{Petty Cash Expenses}$$

---

## 5. UI/UX & Theming Invariants (Apple Cupertino HIG)

### 5.1 CSS Custom Property Architecture (`src/index.css`)
To prevent visual regressions between Cupertino Light Mode and OLED Dark Mode, Kura strictly enforces CSS variables:

```css
:root, [data-theme="light"] {
  --kura-bg-canvas: #F2F4F8;
  --kura-bg-card: #FFFFFF;
  --kura-bg-subtle: #F1F5F9;
  --kura-bg-input: #F8FAFC;
  --kura-bg-glass: rgba(255, 255, 255, 0.88);
  --kura-text-primary: #0F172A;
  --kura-text-secondary: #475569;
  --kura-text-muted: #64748B;
  --kura-border: rgba(15, 23, 42, 0.08);
  --kura-chart-empty: rgba(15, 23, 42, 0.06);
  --kura-shadow-card: 0 1px 3px rgba(15, 23, 42, 0.05);
}

[data-theme="dark"] {
  --kura-bg-canvas: #000000;
  --kura-bg-card: #1C1C1E;
  --kura-bg-subtle: #2C2C2E;
  --kura-bg-input: #121214;
  --kura-bg-glass: rgba(28, 28, 30, 0.88);
  --kura-text-primary: #F5F5F7;
  --kura-text-secondary: #98989D;
  --kura-text-muted: #86868B;
  --kura-border: rgba(255, 255, 255, 0.08);
  --kura-chart-empty: rgba(255, 255, 255, 0.08);
  --kura-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4);
}
```

### 5.2 The Hero CTA Rule
The **New Sale** button in `HomeDashboardView.tsx` uses `.kura-hero-cta`:
- It MUST retain a pure white `#FFFFFF` surface with `#0F172A` text in both light and dark modes, ensuring strong visual contrast against dark titanium and emerald gradient banners.
- Blanket overrides like `[data-theme="dark"] .bg-white` are strictly forbidden.

---

## 6. Hardware & Peripheral Protocol Specifications

### 6.1 Wireless Thermal ESC/POS Engine (`src-tauri/src/escpos.rs`)
- **Transport**: Raw TCP socket streaming on port `9100` (standard thermal printer port).
- **Column Layouts**:
  - `58mm Width`: 32 columns per line (`16 char` name, `4 char` qty, `12 char` line total).
  - `80mm Width`: 48 columns per line (`28 char` name, `6 char` qty, `14 char` line total).
- **Command Sequence**:
  1. `ESC @` (0x1B, 0x40) — Initialize printer hardware.
  2. `ESC a 1` (0x1B, 0x61, 0x01) — Center alignment for shop title.
  3. `GS ! 0x11` — Double-height / double-width header text.
  4. Item lines with tabular spacing.
  5. `GS V 66 0` (0x1D, 0x56, 0x42, 0x00) — Paper cut with feed.

### 6.2 Vector Code-39 Barcode Generator (`src-tauri/src/barcode_pdf.rs`)
- **Encoding Scheme**: Code 39 (3 wide elements, 6 narrow elements per character, 2:1 ratio).
- **A4 Sticker Sheet Specification**:
  - Page Geometry: 210mm × 297mm (A4).
  - Grid: 3 columns × 8 rows (24 labels per sheet).
  - Label Dimensions: 63.5mm × 33.9mm with 2mm corner margins.
  - Formats: High-precision pure vector PDF without raster bitmap artifacts.

### 6.3 Hardware Barcode Scanner Listener (`src/ui/utils/posHotkeys.ts`)
- **Burst Timing Detection**: Hardware USB/Bluetooth laser guns emulate keyboard keystrokes at superhuman speeds. If consecutive character inputs occur within `<35ms` of each other, the buffer is treated as a barcode burst.
- **Auto-Enter Suppression**: Prevents accidental form submits while auto-matching product SKUs or invoice barcodes.

---

## 7. Multi-Phone Cryptographic Sync Chain Protocol

```
+--------------------------------------------------------------------------+
|                       128-Bit Master CSPRNG Seed                         |
|                 (12-Word BIP-39 Encrypted Recovery Phrase)               |
+--------------------------------------------------------------------------+
                                     |
               +---------------------+---------------------+
               |                     |                     |
               v                     v                     v
       HKDF: "aes-256"      HKDF: "owner-role"     SHA-256: "chain-id"
               |                     |                     |
               v                     v                     v
       AES-256-GCM Key        Owner Auth Token      8-Byte Relay Topic
  (End-to-End Encryption)   (Prevents Elevation)  (Zero-Knowledge Routing)
```

1. **Master Seed**: Generated locally using the operating system's cryptographic random generator (`OsRng`).
2. **Key Derivation (HKDF-SHA256)**:
   - `AES-256-GCM Key`: Derives symmetrical 32-byte key for packet payloads and `.kura` backup archives.
   - `Owner Verification Token`: Prevents cashier terminals from spoofing owner status.
   - `Public Relay Chain Hash`: SHA-256 digest identifying message channels without revealing shop identities.
3. **Wire Encryption**: Every LAN and WebSocket payload uses AES-256-GCM with a unique 12-byte random nonce per packet.

---

## 8. Role-Based Access Control (RBAC) & Cost Redaction

Kura implements a strict security boundary between `OWNER` and `CASHIER` terminals:

```
[ Cashier Device (K2) ]                 [ Owner Device (K1) ]
         |                                       |
  Can Ring Sales (Counter)                Full Catalog & Price Editing
  Can View Retail Sell Price              Can View Wholesale Cost Prices
  Can Accept Khata Dues                   Can View Gross & Net Profit Margin
  Can Add Petty Expenses                  Can View Executive P&L Reports
         |                                Can Void Previous Bills
         v                                       |
+------------------------------------------------+-------------------------+
|                  Rust IPC State Redaction Layer                          |
|  - When node_role == 'CASHIER':                                          |
|    - product.cost_price_minor is hard-redacted to 0                     |
|    - ownerAnalytics IPC query is blocked and rejected                    |
+--------------------------------------------------------------------------+
```

---

## 9. Competitive Differentiation & Market Matrix

| Metric / Capability | Loyverse / Square | Device N Gear (Ref POS) | **Kura** |
| :--- | :--- | :--- | :--- |
| **Pricing** | \$29–\$89 / month | Proprietary / Closed | **\$0 (Free & Open-Source, MIT)** |
| **Mandatory Cloud Account** | Yes | Optional | **Zero Accounts Required** |
| **Multi-Phone Sync** | Cloud Server Dependent | Single-Device Only | **Autonomous LAN P2P + Encrypted Relays** |
| **Data Engine** | Cloud DB / Cached | Local SQLite (Mutable) | **Append-Only CRDT SQLite WAL** |
| **Frontend Bundle Size** | > 15 MB (Web/React) | ~35 MB (Flutter) | **`57.23 KB` gzipped (Preact)** |
| **Thermal Receipts** | Cloud / Basic Driver | Native Thermal | **Raw ESC/POS (58mm/80mm) over TCP 9100** |
| **PDF Receipt Engine** | Server-side / Web HTML | Raster Screenshot | **Zero-Dependency Vector PDF 1.4 in Rust** |
| **Warranty Tracking** | Add-on App | Fixed Text | **Bilingual Warranty Tags on Line Items** |
| **Customer Credit (Khata)**| Not Native | Basic List | **Full CRDT Khata Ledger & Settlements** |
| **Cash Drawer Till Math** | Basic Shift Report | Basic Drawer | **Real-Time Formula Reconciliation** |

---

## 10. Instructions for Future AI Sessions & Engineering Playbook

Whenever a new AI agent (or software engineer) continues development on Kura, follow this strict operational protocol:

### 10.1 Initial Context Loading Order
1. Read `.agents/rules/kura-architecture.md` (Global Engineering Invariants).
2. Read `docs/AI_CONTEXT_AND_DECISIONS.md` (This Bible).
3. Read `src/types/kura.ts` (Core TypeScript data models).
4. Read `src-tauri/src/models.rs` (Rust data structures and IPC schemas).

### 10.2 Strict Invariant Checklist for Any Change
- [ ] **220-Line Ceiling**: Check file line length before and after editing. Proactively split views and Rust modules if line count approaches 215 lines.
- [ ] **Integer Money**: Never use floating-point types (`f64`, `float`) for currency math. Use `i64` in Rust and integer minor units in TypeScript.
- [ ] **Append-Only CRDT**: Never write an `UPDATE ... SET stock_qty = ?` query. Create a new `LedgerEvent` variant and handle it in `apply_event_to_projection`.
- [ ] **No Heavy Dependencies**: Do not install external icon libraries, UI component frameworks, or heavy chart packages. Use inline SVG icons and semantic Tailwind classes.
- [ ] **CSS Variable Scoping**: Use `--kura-*` tokens for colors and styling. Never use blanket dark overrides.

### 10.3 Verification Commands
```powershell
# 1. Run Rust test suite (ensure 10/10 pass)
cargo test --manifest-path src-tauri\Cargo.toml

# 2. Check Rust compiler warnings
cargo check --manifest-path src-tauri\Cargo.toml

# 3. Verify TypeScript types and assemble production showcase
npm run build:site

# 4. Audit source file line counts
Get-ChildItem -Path src, src-tauri\src -Include *.rs, *.ts, *.tsx -Recurse | Where-Object { (Get-Content $_.FullName).Count -gt 215 }
```
