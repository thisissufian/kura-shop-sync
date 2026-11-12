import type {
  BillReceipt,
  BootstrapState,
  CustomerAccount,
  IssueBillInput,
  PdfExportResult,
  Product,
  UpsertProductInput,
} from "../types/kura";
import { mockBills, mockCustomers, mockProducts, mockSync, nowHlc } from "./previewFixtures";

export async function previewInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (cmd === "get_bootstrap_state") {
    const state: BootstrapState = { products: [...mockProducts], recent_bills: [...mockBills], customers: [...mockCustomers], sync_status: { ...mockSync } };
    return state as T;
  }
  if (cmd === "upsert_product") {
    if (mockSync.role !== "OWNER") throw new Error("Cashier role cannot edit catalog");
    const input = args?.input as UpsertProductInput;
    const idx = mockProducts.findIndex((p) => p.sku === input.sku);
    const next: Product = { ...input, updated_hlc: nowHlc(9) };
    if (idx >= 0) mockProducts[idx] = next;
    else mockProducts.push(next);
    return next as T;
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
    const input = args?.input as IssueBillInput;
    const items = input.items.map((req) => {
      const p = mockProducts.find((x) => x.sku === req.sku);
      if (!p) throw new Error(`Product not found: ${req.sku}`);
      p.stock_qty -= req.qty;
      return { sku: p.sku, name: p.name, qty: req.qty, unit_price_minor: p.sell_price_minor, line_total_minor: p.sell_price_minor * req.qty };
    });
    const sub = items.reduce((a, b) => a + b.line_total_minor, 0);
    const disc = Math.max(0, Math.min(input.discount_minor, sub));
    const mode = (input.payment_mode || "CASH").toUpperCase();
    const bill: BillReceipt = {
      bill_no: `${mockSync.node_id}-261112-${String(mockBills.length + 1).padStart(4, "0")}`,
      node_id: mockSync.node_id,
      hlc: nowHlc(mockBills.length + 20),
      items,
      discount_minor: disc,
      total_minor: sub - disc,
      payment_mode: mode,
      customer_id: input.customer_id ?? null,
      voided: false,
    };
    if (mode === "DUE" && input.customer_id) {
      const cust = mockCustomers.find((c) => c.customer_id === input.customer_id);
      if (cust) cust.balance_due_minor += bill.total_minor;
    }
    mockBills.unshift(bill);
    return bill as T;
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
    cust.balance_due_minor -= Number(args?.amountMinor ?? 0);
    return { ...cust } as T;
  }
  if (cmd === "get_recent_bills") return [...mockBills] as T;
  if (cmd === "get_sync_status") return { ...mockSync } as T;
  if (cmd === "join_sync_chain") {
    const raw = String(args?.input ?? "");
    mockSync.is_linked = true;
    if (raw.includes("role=CASHIER")) {
      mockSync.role = "CASHIER";
      mockSync.node_id = "K3";
    } else if (args?.roleOverride === "CASHIER") {
      mockSync.role = "CASHIER";
      mockSync.node_id = "K3";
    } else {
      mockSync.role = "OWNER";
      mockSync.node_id = "K2";
    }
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
    if (mockSync.role !== "OWNER") throw new Error("Only OWNER devices can update shop profile");
    const input = args?.input as { shop_name: string; shop_subtitle: string; currency_symbol: string; receipt_footer: string };
    mockSync.shop_name = input.shop_name;
    mockSync.shop_subtitle = input.shop_subtitle;
    mockSync.currency_symbol = input.currency_symbol;
    mockSync.receipt_footer = input.receipt_footer;
    return { ...mockSync } as T;
  }
  if (cmd === "get_owner_analytics") {
    if (mockSync.role !== "OWNER") throw new Error("Profit analytics are locked to OWNER devices");
    let gross = 0;
    let cogs = 0;
    let voided = 0;
    const perNode = new Map<string, { bills_count: number; revenue_minor: number }>();
    for (const b of mockBills) {
      if (b.voided) { voided++; continue; }
      gross += b.total_minor;
      const cur = perNode.get(b.node_id) ?? { bills_count: 0, revenue_minor: 0 };
      cur.bills_count += 1;
      cur.revenue_minor += b.total_minor;
      perNode.set(b.node_id, cur);
      for (const it of b.items) {
        const p = mockProducts.find((x) => x.sku === it.sku);
        cogs += (p?.cost_price_minor ?? 0) * it.qty;
      }
    }
    const net = gross - cogs;
    return {
      gross_revenue_minor: gross,
      estimated_cogs_minor: cogs,
      net_profit_minor: net,
      margin_bps: gross > 0 ? Math.trunc((net * 10000) / gross) : 0,
      total_bills_count: mockBills.length - voided,
      voided_bills_count: voided,
      terminal_breakdown: Array.from(perNode.entries()).map(([node_id, v]) => ({ node_id, ...v })),
    } as T;
  }
  if (cmd === "export_barcode_labels_pdf") {
    return {
      file_path: "KuraReceipts/kura-labels-261112.pdf",
      data_url: "data:text/plain;base64,S3VyYSBMYWJlbHMgUERG",
      size_bytes: 4096,
    } as T;
  }
  if (cmd === "export_catalog_csv") {
    const header = "sku,name,barcode,category,sell_price,cost_price,stock_qty,low_stock_threshold\n";
    return (header + mockProducts.map((p) => `${p.sku},${p.name},${p.barcode ?? ""},${p.category},${(p.sell_price_minor / 100).toFixed(2)},${(p.cost_price_minor / 100).toFixed(2)},${p.stock_qty},${p.low_stock_threshold}`).join("\n")) as T;
  }
  if (cmd === "import_catalog_csv") return 0 as T;
  if (cmd === "export_encrypted_vault") {
    return {
      file_path: "KuraReceipts/kura-vault-261112.kura",
      payload_b64: "S3VyYVZhdWx0UHJldmlldw==",
      events_count: mockProducts.length + mockBills.length,
      size_bytes: 512,
    } as T;
  }
  if (cmd === "import_encrypted_vault") return 0 as T;
  if (cmd === "prepare_relay_envelope") {
    return { chain_id_hash: "preview01", latest_hlc: nowHlc(99), cipher_b64: "" } as T;
  }
  if (cmd === "ingest_relay_envelope") return 0 as T;
  if (cmd === "export_bill_pdf") {
    const res: PdfExportResult = {
      file_path: `KuraReceipts/${args?.billNo}.pdf`,
      data_url: "data:text/plain;base64,S3VyYSBQREYgUHJldmlldw==",
      size_bytes: 2048,
    };
    return res as T;
  }
  throw new Error(`Unsupported preview command: ${cmd}`);
}
