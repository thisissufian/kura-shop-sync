import type {
  BillReceipt,
  IssueBillInput,
  Product,
  StockPurchaseInput,
  SupplierAccount,
  UpsertProductInput,
} from "../types/kura";
import {
  mockBills,
  mockCustomers,
  mockProducts,
  mockSuppliers,
  mockSync,
  nowHlc,
} from "./previewFixtures";

export function handleUpsertProduct(input: UpsertProductInput): Product {
  const idx = mockProducts.findIndex((p) => p.sku === input.sku);
  const next: Product = {
    ...input,
    brand: input.brand || "",
    variant: input.variant || "",
    warranty_label: input.warranty_label || "No Warranty (ওয়ারেন্টি নেই)",
    updated_hlc: nowHlc(9),
  };
  if (idx >= 0) mockProducts[idx] = next;
  else mockProducts.push(next);
  return next;
}

export function handleIssueBill(input: IssueBillInput): BillReceipt {
  const items = input.items.map((req) => {
    const p = mockProducts.find((x) => x.sku === req.sku);
    if (!p) throw new Error(`Product not found: ${req.sku}`);
    p.stock_qty -= req.qty;
    return {
      sku: p.sku,
      name: p.name,
      qty: req.qty,
      unit_price_minor: p.sell_price_minor,
      line_total_minor: p.sell_price_minor * req.qty,
      warranty_label: req.warranty_label || p.warranty_label || "No Warranty (ওয়ারেন্টি নেই)",
    };
  });
  const sub = items.reduce((a, b) => a + b.line_total_minor, 0);
  const disc = Math.max(0, Math.min(input.discount_minor, sub));
  const mode = (input.payment_mode || "CASH").toUpperCase();
  const bill: BillReceipt = {
    bill_no: `${mockSync.node_id}-261113-${String(mockBills.length + 1).padStart(4, "0")}`,
    node_id: mockSync.node_id,
    hlc: nowHlc(mockBills.length + 20),
    items,
    discount_minor: disc,
    total_minor: sub - disc,
    payment_mode: mode,
    customer_id: input.customer_id ?? null,
    client_label: input.client_label || "Walk-in Customer",
    cashier_label: input.cashier_label || `${mockSync.role === "OWNER" ? "Owner" : "Cashier"} · ${mockSync.node_id}`,
    voided: false,
  };
  if (mode === "DUE" && input.customer_id) {
    const cust = mockCustomers.find((c) => c.customer_id === input.customer_id);
    if (cust) cust.balance_due_minor += bill.total_minor;
  }
  mockBills.unshift(bill);
  return bill;
}

export function handleStockPurchase(inp: StockPurchaseInput): SupplierAccount {
  const sid = inp.supplier_id || `K1-V${mockSuppliers.length + 1}`;
  let supp = mockSuppliers.find((s) => s.supplier_id === sid);
  const due = inp.unit_cost_minor * inp.qty - inp.paid_minor;
  if (supp) {
    supp.payable_balance_minor += due;
  } else {
    supp = {
      supplier_id: sid,
      name: inp.supplier_name,
      phone: inp.supplier_phone || "",
      payable_balance_minor: due,
      updated_hlc: nowHlc(),
    };
    mockSuppliers.unshift(supp);
  }
  const p = mockProducts.find((x) => x.sku === inp.sku);
  if (p) {
    p.stock_qty += inp.qty;
    p.cost_price_minor = inp.unit_cost_minor;
  }
  return supp;
}
