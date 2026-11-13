use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierAccount {
    pub supplier_id: String,
    pub name: String,
    pub phone: String,
    pub payable_balance_minor: i64,
    pub updated_hlc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockPurchaseInput {
    #[serde(default)]
    pub supplier_id: Option<String>,
    pub supplier_name: String,
    #[serde(default)]
    pub supplier_phone: Option<String>,
    pub sku: String,
    pub qty: i64,
    pub unit_cost_minor: i64,
    pub paid_minor: i64,
}
