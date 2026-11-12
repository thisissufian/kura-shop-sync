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
  voided: boolean;
}

export interface SyncChainStatus {
  is_linked: boolean;
  node_id: string;
  role: "OWNER" | "CASHIER" | string;
  shop_name: string;
  currency_symbol: string;
  peer_count: number;
  pending_events: number;
  lan_ip: string;
  pairing_uri_owner: string;
  pairing_uri_cashier: string;
  recovery_phrase: string;
}

export interface BootstrapState {
  products: Product[];
  recent_bills: BillReceipt[];
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
