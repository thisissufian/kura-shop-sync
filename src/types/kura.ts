export interface Product {
  sku: string;
  name: string;
  barcode: string | null;
  category: string;
  sell_price_minor: number;
  cost_price_minor: number;
  stock_qty: number;
  low_stock_threshold: number;
  updated_hlc: string;
}

export interface BillItem {
  sku: string;
  name: string;
  qty: number;
  unit_price_minor: number;
  line_total_minor: number;
}

export interface BillReceipt {
  bill_no: string;
  node_id: string;
  hlc: string;
  items: BillItem[];
  discount_minor: number;
  total_minor: number;
  payment_mode: string;
  customer_id?: string | null;
  voided: boolean;
}

export interface CustomerAccount {
  customer_id: string;
  name: string;
  phone: string;
  balance_due_minor: number;
  updated_hlc: string;
}

export interface SyncChainStatus {
  is_linked: boolean;
  node_id: string;
  role: "OWNER" | "CASHIER" | string;
  shop_name: string;
  shop_subtitle: string;
  currency_symbol: string;
  receipt_footer: string;
  peer_count: number;
  pending_events: number;
  lan_ip: string;
  pairing_uri_owner: string;
  pairing_uri_cashier: string;
  recovery_phrase: string;
}

export interface ShopSettings {
  shop_name: string;
  shop_subtitle: string;
  currency_symbol: string;
  receipt_footer: string;
  node_id: string;
  role: string;
}

export interface ShopSettingsInput {
  shop_name: string;
  shop_subtitle: string;
  currency_symbol: string;
  receipt_footer: string;
}

export interface TerminalSalesSummary {
  node_id: string;
  bills_count: number;
  revenue_minor: number;
}

export interface OwnerAnalytics {
  gross_revenue_minor: number;
  estimated_cogs_minor: number;
  net_profit_minor: number;
  margin_bps: number;
  total_bills_count: number;
  voided_bills_count: number;
  terminal_breakdown: TerminalSalesSummary[];
}

export interface VaultExportResult {
  file_path: string;
  payload_b64: string;
  events_count: number;
  size_bytes: number;
}

export interface RelayEnvelope {
  chain_id_hash: string;
  latest_hlc: string;
  cipher_b64: string;
}

export interface BootstrapState {
  products: Product[];
  recent_bills: BillReceipt[];
  customers: CustomerAccount[];
  sync_status: SyncChainStatus;
}

export interface UpsertProductInput {
  sku: string;
  name: string;
  barcode: string | null;
  category: string;
  sell_price_minor: number;
  cost_price_minor: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface IssueBillItemInput {
  sku: string;
  qty: number;
}

export interface IssueBillInput {
  items: IssueBillItemInput[];
  discount_minor: number;
  payment_mode: string;
  customer_id?: string | null;
}

export interface PdfExportResult {
  file_path: string;
  data_url: string;
  size_bytes: number;
}

export interface PrinterSettings {
  ip: string;
  port: number;
  widthMm: 58 | 80;
}

export type KuraTab = "counter" | "vault" | "bills" | "sync";
