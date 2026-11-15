import type { BillReceipt, CashDrawerSummary, CustomerAccount, Product, ShopExpense, SupplierAccount, SyncChainStatus } from "../types/kura";

export const nowHlc = (n = 1) => `${new Date().toISOString()}-${String(n).padStart(4, "0")}-K1`;

export const mockExpenses: ShopExpense[] = [
  { expense_id: "EXP-1", category: "Rent & Bills", amount_minor: 12000, note: "Shop power bill", node_id: "K1", hlc: nowHlc(10) }
];
export const mockKhataCollected = { minor: 0 };

export const mockSuppliers: SupplierAccount[] = [
  { supplier_id: "K1-V001", name: "HOCO Accessories Hub", phone: "01811-998877", payable_balance_minor: 125000, updated_hlc: nowHlc(1) },
  { supplier_id: "K1-V002", name: "Anker BD Official", phone: "01922-334455", payable_balance_minor: 280000, updated_hlc: nowHlc(2) },
];

export function calcMockDrawer(): CashDrawerSummary {
  let cash = 0;
  let wallet = 0;
  let due = 0;
  for (const b of mockBills) {
    if (b.voided) continue;
    if (b.payment_mode === "CASH") cash += b.total_minor;
    else if (b.payment_mode === "WALLET") wallet += b.total_minor;
    else if (b.payment_mode === "DUE") due += b.total_minor;
  }
  const exp = mockExpenses.reduce((a, e) => a + e.amount_minor, 0);
  return {
    cash_sales_minor: cash,
    wallet_sales_minor: wallet,
    due_issued_minor: due,
    khata_cash_collected_minor: mockKhataCollected.minor,
    total_expenses_minor: exp,
    expected_drawer_cash_minor: cash + mockKhataCollected.minor - exp,
    recent_expenses: [...mockExpenses],
  };
}

export const mockCustomers: CustomerAccount[] = [
  { customer_id: "K1-C001", name: "Rahim Traders", phone: "01711-000111", balance_due_minor: 145000, updated_hlc: nowHlc(1) },
];

export const mockProducts: Product[] = [
  { sku: "SKU-101", name: "Artisan Cold Brew 250ml", barcode: "890101001010", category: "Beverages", brand: "Kura Brew", variant: "250ml", warranty_label: "No Warranty (ওয়ারেন্টি নেই)", sell_price_minor: 35000, cost_price_minor: 18000, stock_qty: 24, low_stock_threshold: 6, updated_hlc: nowHlc(1) },
  { sku: "SKU-102", name: "Organic Whole Milk 1L", barcode: "890101001027", category: "Dairy", brand: "FarmFresh", variant: "1L Tetra", warranty_label: "No Warranty (ওয়ারেন্টি নেই)", sell_price_minor: 29500, cost_price_minor: 21000, stock_qty: 18, low_stock_threshold: 5, updated_hlc: nowHlc(2) },
  { sku: "SKU-103", name: "Sourdough Country Loaf", barcode: "890101001034", category: "Bakery", brand: "Artisan Oven", variant: "Round", warranty_label: "No Warranty (ওয়ারেন্টি নেই)", sell_price_minor: 55000, cost_price_minor: 29000, stock_qty: 9, low_stock_threshold: 4, updated_hlc: nowHlc(3) },
  { sku: "SKU-104", name: "Sea Salt Kettle Chips", barcode: "890101001041", category: "Snacks", brand: "Kettle Co", variant: "Original", warranty_label: "No Warranty (ওয়ারেন্টি নেই)", sell_price_minor: 12000, cost_price_minor: 6500, stock_qty: 14, low_stock_threshold: 5, updated_hlc: nowHlc(4) },
  { sku: "SKU-105", name: "HOCO Rapid Charger 65W", barcode: "890101001058", category: "Electronics", brand: "HOCO", variant: "White · GaN", warranty_label: "6 Months Warranty", sell_price_minor: 149000, cost_price_minor: 89000, stock_qty: 12, low_stock_threshold: 3, updated_hlc: nowHlc(5) },
];

export const mockBills: BillReceipt[] = [
  {
    bill_no: "K1-261115-0001",
    node_id: "K1",
    hlc: nowHlc(6),
    items: [
      { sku: "SKU-105", name: "HOCO Rapid Charger 65W", qty: 1, unit_price_minor: 149000, line_total_minor: 149000, warranty_label: "6 Months Warranty" },
      { sku: "SKU-101", name: "Artisan Cold Brew 250ml", qty: 2, unit_price_minor: 35000, line_total_minor: 70000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)" },
      { sku: "SKU-103", name: "Sourdough Country Loaf", qty: 1, unit_price_minor: 55000, line_total_minor: 55000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)" },
      { sku: "SKU-104", name: "Sea Salt Kettle Chips", qty: 1, unit_price_minor: 12000, line_total_minor: 12000, warranty_label: "No Warranty (ওয়ারেন্টি নেই)" },
    ],
    discount_minor: 0,
    total_minor: 286000,
    payment_mode: "CASH",
    customer_id: null,
    client_label: "Walk-in Customer",
    cashier_label: "Owner · K1",
    voided: false,
  },
];

export const mockSync: SyncChainStatus = {
  is_linked: false,
  node_id: "K1",
  role: "OWNER",
  shop_name: "Kura General Store",
  shop_subtitle: "Local Retail · Offline POS",
  currency_symbol: "৳",
  receipt_footer: "Thank you for shopping!",
  peer_count: 0,
  pending_events: 0,
  lan_ip: "127.0.0.1:42850",
  pairing_uri_owner: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=OWNER&node=K2&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  pairing_uri_cashier: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=CASHIER&node=K3&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  recovery_phrase: "kald mint bark fast lamp gold silk rest park wind bold sand",
};
