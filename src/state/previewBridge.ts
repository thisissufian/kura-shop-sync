import type {
  BootstrapState,
  CustomerAccount,
  IssueBillInput,
  PdfExportResult,
  StockPurchaseInput,
  UpsertProductInput,
} from "../types/kura";
import { calcMockAnalytics } from "./previewAnalytics";
import {
  calcMockDrawer,
  mockBills,
  mockCustomers,
  mockExpenses,
  mockKhataCollected,
  mockProducts,
  mockSuppliers,
  mockSync,
  nowHlc,
} from "./previewFixtures";
import { handleIssueBill, handleStockPurchase, handleUpsertProduct } from "./previewHandlers";

export async function previewInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (cmd === "get_bootstrap_state") {
    const state: BootstrapState = {
      products: [...mockProducts],
      recent_bills: [...mockBills],
      customers: [...mockCustomers],
      sync_status: { ...mockSync },
    };
    return state as T;
  }
  if (cmd === "upsert_product") {
    if (mockSync.role !== "OWNER") throw new Error("Cashier role cannot edit catalog");
    return handleUpsertProduct(args?.input as UpsertProductInput) as T;
  }
  if (cmd === "adjust_stock") {
    const sku = String(args?.sku);
    const delta = Number(args?.delta ?? 0);
    const item = mockProducts.find((p) => p.sku === sku);
    if (!item) throw new Error(`Unknown SKU: ${sku}`);
    item.stock_qty += delta;
    item.updated_hlc = nowHlc(10);
    return { ...item } as T;
  }
  if (cmd === "issue_bill") {
    return handleIssueBill(args?.input as IssueBillInput) as T;
  }
  if (cmd === "void_bill") {
    if (mockSync.role !== "OWNER") throw new Error("Only OWNER devices can void bills");
    const bill = mockBills.find((b) => b.bill_no === args?.billNo);
    if (!bill || bill.voided) throw new Error("Bill cannot be voided");
    bill.voided = true;
    for (const it of bill.items) {
      const p = mockProducts.find((x) => x.sku === it.sku);
      if (p) p.stock_qty += it.qty;
    }
    if (bill.payment_mode === "DUE" && bill.customer_id) {
      const cust = mockCustomers.find((c) => c.customer_id === bill.customer_id);
      if (cust) cust.balance_due_minor -= bill.total_minor;
    }
    return { ...bill } as T;
  }
  if (cmd === "get_customers") return [...mockCustomers] as T;
  if (cmd === "upsert_customer") {
    const name = String(args?.name ?? "").trim();
    const phone = String(args?.phone ?? "").trim();
    const cid = String(args?.customerId || `K1-C${mockCustomers.length + 100}`);
    const existing = mockCustomers.find((c) => c.customer_id === cid);
    if (existing) { existing.name = name; existing.phone = phone; return { ...existing } as T; }
    const next: CustomerAccount = { customer_id: cid, name, phone, balance_due_minor: 0, updated_hlc: nowHlc(30) };
    mockCustomers.unshift(next);
    return { ...next } as T;
  }
  if (cmd === "record_customer_payment") {
    const cust = mockCustomers.find((c) => c.customer_id === args?.customerId);
    if (!cust) throw new Error("Customer not found");
    const amt = Number(args?.amountMinor ?? 0);
    cust.balance_due_minor -= amt;
    mockKhataCollected.minor += amt;
    return { ...cust } as T;
  }
  if (cmd === "get_suppliers") return [...mockSuppliers] as T;
  if (cmd === "record_stock_purchase") {
    return handleStockPurchase(args?.input as StockPurchaseInput) as T;
  }
  if (cmd === "record_supplier_payment") {
    const supp = mockSuppliers.find((s) => s.supplier_id === args?.supplierId);
    if (!supp) throw new Error("Supplier not found");
    supp.payable_balance_minor -= Number(args?.amountMinor ?? 0);
    return supp as T;
  }
  if (cmd === "get_owner_analytics") {
    if (mockSync.role !== "OWNER") throw new Error("Profit analytics are locked to OWNER devices");
    return calcMockAnalytics(String(args?.period ?? "ALL")) as T;
  }
  if (cmd === "get_recent_bills") return [...mockBills] as T;
  if (cmd === "find_bill_by_no") {
    const target = String(args?.billNo ?? "").toUpperCase();
    return (mockBills.find((b) => b.bill_no.toUpperCase() === target) ?? null) as T;
  }
  if (cmd === "get_cash_drawer_summary") return calcMockDrawer() as T;
  if (cmd === "log_shop_expense") {
    const exp = {
      expense_id: `EXP-${mockExpenses.length + 1}`,
      category: String(args?.category ?? "Supplies"),
      amount_minor: Number(args?.amountMinor ?? 0),
      note: String(args?.note ?? ""),
      node_id: mockSync.node_id,
      hlc: nowHlc(80 + mockExpenses.length),
    };
    mockExpenses.unshift(exp);
    return exp as T;
  }
  if (cmd === "get_sync_status") return { ...mockSync } as T;
  if (cmd === "join_sync_chain") {
    const raw = String(args?.input ?? "");
    mockSync.is_linked = true;
    mockSync.role = raw.includes("role=CASHIER") || args?.roleOverride === "CASHIER" ? "CASHIER" : "OWNER";
    mockSync.node_id = mockSync.role === "CASHIER" ? "K3" : "K2";
    return { ...mockSync } as T;
  }
  if (cmd === "trigger_peer_sync") return `Preview LAN check: ${mockSync.peer_count} peer(s)` as T;
  if (cmd === "print_bill_thermal") return `Preview ESC/POS queued for ${args?.ip}:${args?.port}` as T;
  if (cmd === "get_shop_settings") {
    return {
      shop_name: mockSync.shop_name,
      shop_subtitle: mockSync.shop_subtitle,
      currency_symbol: mockSync.currency_symbol,
      receipt_footer: mockSync.receipt_footer,
      node_id: mockSync.node_id,
      role: mockSync.role,
    } as T;
  }
  if (cmd === "update_shop_settings") {
    const input = args?.input as { shop_name: string; shop_subtitle: string; currency_symbol: string; receipt_footer: string };
    mockSync.shop_name = input.shop_name;
    mockSync.shop_subtitle = input.shop_subtitle;
    mockSync.currency_symbol = input.currency_symbol;
    mockSync.receipt_footer = input.receipt_footer;
    return { ...mockSync } as T;
  }
  if (cmd === "export_barcode_labels_pdf") {
    return { file_path: "KuraReceipts/kura-labels-261113.pdf", data_url: "data:text/plain;base64,S3VyYQ==", size_bytes: 4096 } as T;
  }
  if (cmd === "export_catalog_csv") {
    const header = "sku,name,barcode,category,sell_price,cost_price,stock_qty,low_stock_threshold\n";
    return (header + mockProducts.map((p) => `${p.sku},${p.name},${p.barcode ?? ""},${p.category},${(p.sell_price_minor / 100).toFixed(2)},${(p.cost_price_minor / 100).toFixed(2)},${p.stock_qty},${p.low_stock_threshold}`).join("\n")) as T;
  }
  if (cmd === "import_catalog_csv") return 0 as T;
  if (cmd === "export_encrypted_vault") {
    return { file_path: "KuraReceipts/kura-vault-261113.kura", payload_b64: "S3VyYVZhdWx0", events_count: mockProducts.length + mockBills.length, size_bytes: 512 } as T;
  }
  if (cmd === "import_encrypted_vault") return 0 as T;
  if (cmd === "prepare_relay_envelope") {
    return { chain_id_hash: "preview01", latest_hlc: nowHlc(99), cipher_b64: "" } as T;
  }
  if (cmd === "ingest_relay_envelope") return 0 as T;
  if (cmd === "export_bill_pdf") {
    const res: PdfExportResult = {
      file_path: `KuraReceipts/${args?.billNo}.pdf`,
      data_url: "data:text/plain;base64,S3VyYSBQREY=",
      size_bytes: 2048,
    };
    return res as T;
  }
  throw new Error(`Unsupported preview command: ${cmd}`);
}
