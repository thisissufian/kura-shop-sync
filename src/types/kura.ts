export interface Product {
  sku: string;
  name: string;
  barcode: string | null;
  category: string;
  brand: string;
  variant: string;
  warranty_label: string;
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
  warranty_label: string;
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
  client_label: string;
  cashier_label: string;
  voided: boolean;
}

export interface CustomerAccount {
  customer_id: string;
  name: string;
  phone: string;
  balance_due_minor: number;
  updated_hlc: string;
}

export interface SupplierAccount {
  supplier_id: string;
  name: string;
  phone: string;
  payable_balance_minor: number;
  updated_hlc: string;
}

export interface StockPurchaseInput {
  supplier_id?: string;
  supplier_name: string;
  supplier_phone?: string;
  sku: string;
  qty: number;
  unit_cost_minor: number;
  paid_minor: number;
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

export interface DailySalesPoint {
  date_label: string;
  revenue_minor: number;
  profit_minor: number;
  bills_count: number;
}

export interface OwnerAnalytics {
  period: string;
  gross_revenue_minor: number;
  estimated_cogs_minor: number;
  gross_profit_minor: number;
  operating_expenses_minor: number;
  net_operating_profit_minor: number;
  margin_bps: number;
  total_bills_count: number;
  voided_bills_count: number;
  inventory_cost_value_minor: number;
  retail_market_value_minor: number;
  total_inventory_units: number;
  customer_receivables_minor: number;
  supplier_payables_minor: number;
  terminal_breakdown: TerminalSalesSummary[];
  daily_trend: DailySalesPoint[];
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
  brand?: string;
  variant?: string;
  warranty_label?: string;
  sell_price_minor: number;
  cost_price_minor: number;
  stock_qty: number;
  low_stock_threshold: number;
}

export interface IssueBillItemInput {
  sku: string;
  qty: number;
  warranty_label?: string;
}

export interface IssueBillInput {
  items: IssueBillItemInput[];
  discount_minor: number;
  payment_mode: string;
  customer_id?: string | null;
  client_label?: string;
  cashier_label?: string;
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

export interface ShopExpense {
  expense_id: string;
  category: string;
  amount_minor: number;
  note: string;
  node_id: string;
  hlc: string;
}

export interface CashDrawerSummary {
  cash_sales_minor: number;
  wallet_sales_minor: number;
  due_issued_minor: number;
  khata_cash_collected_minor: number;
  total_expenses_minor: number;
  expected_drawer_cash_minor: number;
  recent_expenses: ShopExpense[];
}

export type KuraTab = "home" | "vault" | "counter" | "reports" | "sync";
