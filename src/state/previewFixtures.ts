import type { BillReceipt, CustomerAccount, Product, SyncChainStatus } from "../types/kura";

export const nowHlc = (n = 1) => `${new Date().toISOString()}-${String(n).padStart(4, "0")}-K1`;

export const mockCustomers: CustomerAccount[] = [
  { customer_id: "K1-C001", name: "Rahim Traders", phone: "01711-000111", balance_due_minor: 1450, updated_hlc: nowHlc(1) },
];

export const mockProducts: Product[] = [
  { sku: "SKU-101", name: "Artisan Cold Brew 250ml", barcode: "890101001010", category: "Beverages", sell_price_minor: 350, cost_price_minor: 180, stock_qty: 24, low_stock_threshold: 6, updated_hlc: nowHlc(1) },
  { sku: "SKU-102", name: "Organic Whole Milk 1L", barcode: "890101001027", category: "Dairy", sell_price_minor: 295, cost_price_minor: 210, stock_qty: 18, low_stock_threshold: 5, updated_hlc: nowHlc(2) },
  { sku: "SKU-103", name: "Sourdough Country Loaf", barcode: "890101001034", category: "Bakery", sell_price_minor: 550, cost_price_minor: 290, stock_qty: 9, low_stock_threshold: 4, updated_hlc: nowHlc(3) },
  { sku: "SKU-104", name: "Sea Salt Kettle Chips", barcode: "890101001041", category: "Snacks", sell_price_minor: 225, cost_price_minor: 120, stock_qty: 4, low_stock_threshold: 5, updated_hlc: nowHlc(4) },
  { sku: "SKU-105", name: "Matcha Green Tea Tin", barcode: "890101001058", category: "Pantry", sell_price_minor: 1490, cost_price_minor: 890, stock_qty: 12, low_stock_threshold: 3, updated_hlc: nowHlc(5) },
];

export const mockBills: BillReceipt[] = [];

export const mockSync: SyncChainStatus = {
  is_linked: false,
  node_id: "K1",
  role: "OWNER",
  shop_name: "Kura General Store",
  shop_subtitle: "Local Retail · Offline POS",
  currency_symbol: "$",
  receipt_footer: "Thank you for shopping!",
  peer_count: 0,
  pending_events: 0,
  lan_ip: "127.0.0.1:42850",
  pairing_uri_owner: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=OWNER&node=K2&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  pairing_uri_cashier: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=CASHIER&node=K3&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  recovery_phrase: "kald mint bark fast lamp gold silk rest park wind bold sand",
};
