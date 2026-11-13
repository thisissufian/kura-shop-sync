use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySalesPoint {
    pub date_label: String,
    pub revenue_minor: i64,
    pub profit_minor: i64,
    pub bills_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSalesSummary {
    pub node_id: String,
    pub bills_count: i64,
    pub revenue_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnerAnalytics {
    pub period: String,
    pub gross_revenue_minor: i64,
    pub estimated_cogs_minor: i64,
    pub gross_profit_minor: i64,
    pub operating_expenses_minor: i64,
    pub net_operating_profit_minor: i64,
    pub margin_bps: i64,
    pub total_bills_count: i64,
    pub voided_bills_count: i64,
    pub inventory_cost_value_minor: i64,
    pub retail_market_value_minor: i64,
    pub total_inventory_units: i64,
    pub customer_receivables_minor: i64,
    pub supplier_payables_minor: i64,
    pub terminal_breakdown: Vec<TerminalSalesSummary>,
    pub daily_trend: Vec<DailySalesPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopExpense {
    pub expense_id: String,
    pub category: String,
    pub amount_minor: i64,
    pub note: String,
    pub node_id: String,
    pub hlc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashDrawerSummary {
    pub cash_sales_minor: i64,
    pub wallet_sales_minor: i64,
    pub due_issued_minor: i64,
    pub khata_cash_collected_minor: i64,
    pub total_expenses_minor: i64,
    pub expected_drawer_cash_minor: i64,
    pub recent_expenses: Vec<ShopExpense>,
}
