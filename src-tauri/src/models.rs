use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub sku: String,
    pub name: String,
    pub barcode: Option<String>,
    pub category: String,
    pub sell_price_minor: i64,
    pub cost_price_minor: i64,
    pub stock_qty: i64,
    pub low_stock_threshold: i64,
    pub updated_hlc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillItem {
    pub sku: String,
    pub name: String,
    pub qty: i64,
    pub unit_price_minor: i64,
    pub line_total_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillReceipt {
    pub bill_no: String,
    pub node_id: String,
    pub hlc: String,
    pub items: Vec<BillItem>,
    pub discount_minor: i64,
    pub total_minor: i64,
    pub payment_mode: String,
    #[serde(default)]
    pub customer_id: Option<String>,
    #[serde(default)]
    pub voided: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerAccount {
    pub customer_id: String,
    pub name: String,
    pub phone: String,
    pub balance_due_minor: i64,
    pub updated_hlc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEvent {
    pub event_id: String,
    pub hlc: String,
    pub node_id: String,
    pub event_type: String,
    pub payload_json: String,
    pub synced_lan: i64,
    pub synced_relay: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncChainStatus {
    pub is_linked: bool,
    pub node_id: String,
    pub role: String,
    pub shop_name: String,
    pub shop_subtitle: String,
    pub currency_symbol: String,
    pub receipt_footer: String,
    pub peer_count: usize,
    pub pending_events: i64,
    pub lan_ip: String,
    pub pairing_uri_owner: String,
    pub pairing_uri_cashier: String,
    pub recovery_phrase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapState {
    pub products: Vec<Product>,
    pub recent_bills: Vec<BillReceipt>,
    pub customers: Vec<CustomerAccount>,
    pub sync_status: SyncChainStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertProductInput {
    pub sku: String,
    pub name: String,
    pub barcode: Option<String>,
    pub category: String,
    pub sell_price_minor: i64,
    pub cost_price_minor: i64,
    pub stock_qty: i64,
    pub low_stock_threshold: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueBillItemInput {
    pub sku: String,
    pub qty: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueBillInput {
    pub items: Vec<IssueBillItemInput>,
    pub discount_minor: i64,
    pub payment_mode: String,
    #[serde(default)]
    pub customer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfExportResult {
    pub file_path: String,
    pub data_url: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultExportResult {
    pub file_path: String,
    pub payload_b64: String,
    pub events_count: usize,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayEnvelope {
    pub chain_id_hash: String,
    pub latest_hlc: String,
    pub cipher_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopSettings {
    pub shop_name: String,
    pub shop_subtitle: String,
    pub currency_symbol: String,
    pub receipt_footer: String,
    pub node_id: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopSettingsInput {
    pub shop_name: String,
    pub shop_subtitle: String,
    pub currency_symbol: String,
    pub receipt_footer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSalesSummary {
    pub node_id: String,
    pub bills_count: i64,
    pub revenue_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnerAnalytics {
    pub gross_revenue_minor: i64,
    pub estimated_cogs_minor: i64,
    pub net_profit_minor: i64,
    pub margin_bps: i64,
    pub total_bills_count: i64,
    pub voided_bills_count: i64,
    pub terminal_breakdown: Vec<TerminalSalesSummary>,
}

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub node_id: String,
    pub shop_name: String,
    pub shop_subtitle: String,
    pub currency_symbol: String,
    pub receipt_footer: String,
    pub role: String,
    pub seed_b64: String,
    pub last_hlc: String,
    pub is_linked: bool,
}
