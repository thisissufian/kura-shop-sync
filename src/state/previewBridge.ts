import type {
  BillReceipt,
  BootstrapState,
  IssueBillInput,
  PdfExportResult,
  Product,
  SyncChainStatus,
  UpsertProductInput,
} from "../types/kura";

const nowHlc = (n = 1) => `${new Date().toISOString()}-${String(n).padStart(4, "0")}-K1`;

const mockProducts: Product[] = [
  { sku: "SKU-101", name: "Artisan Cold Brew 250ml", barcode: "890101001010", category: "Beverages", sell_price_minor: 350, cost_price_minor: 180, stock_qty: 24, low_stock_threshold: 6, updated_hlc: nowHlc(1) },
  { sku: "SKU-102", name: "Organic Whole Milk 1L", barcode: "890101001027", category: "Dairy", sell_price_minor: 295, cost_price_minor: 210, stock_qty: 18, low_stock_threshold: 5, updated_hlc: nowHlc(2) },
  { sku: "SKU-103", name: "Sourdough Country Loaf", barcode: "890101001034", category: "Bakery", sell_price_minor: 550, cost_price_minor: 290, stock_qty: 9, low_stock_threshold: 4, updated_hlc: nowHlc(3) },
  { sku: "SKU-104", name: "Sea Salt Kettle Chips", barcode: "890101001041", category: "Snacks", sell_price_minor: 225, cost_price_minor: 120, stock_qty: 4, low_stock_threshold: 5, updated_hlc: nowHlc(4) },
  { sku: "SKU-105", name: "Matcha Green Tea Tin", barcode: "890101001058", category: "Pantry", sell_price_minor: 1490, cost_price_minor: 890, stock_qty: 12, low_stock_threshold: 3, updated_hlc: nowHlc(5) },
];

const mockBills: BillReceipt[] = [];
const mockSync: SyncChainStatus = {
  is_linked: false,
  node_id: "K1",
  role: "OWNER",
  shop_name: "Kura General Store",
  currency_symbol: "$",
  peer_count: 0,
  pending_events: 0,
  lan_ip: "127.0.0.1:42850",
  pairing_uri_owner: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=OWNER&node=K2&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  pairing_uri_cashier: "kura://join?seed=AAECAwQFBgcICQoLDA0ODw&role=CASHIER&node=K3&shop=Kura%20General%20Store&lan=127.0.0.1%3A42850",
  recovery_phrase: "kald mint bark fast lamp gold silk rest park wind bold sand",
};

export async function previewInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (cmd === "get_bootstrap_state") {
    const state: BootstrapState = { products: [...mockProducts], recent_bills: [...mockBills], sync_status: { ...mockSync } };
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
    const bill: BillReceipt = {
      bill_no: `${mockSync.node_id}-261112-${String(mockBills.length + 1).padStart(4, "0")}`,
      node_id: mockSync.node_id,
      hlc: nowHlc(mockBills.length + 20),
      items,
      discount_minor: disc,
      total_minor: sub - disc,
      payment_mode: input.payment_mode || "CASH",
      voided: false,
    };
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
    return { ...bill } as T;
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
