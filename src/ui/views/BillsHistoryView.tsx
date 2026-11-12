import {
  activeReceipt,
  currencySymbol,
  formatMoney,
  recentBills,
} from "../../state/kuraStore";

export function BillsHistoryView() {
  const bills = recentBills.value;
  const sym = currencySymbol.value;

  return (
    <div class="space-y-3 pb-8">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-[18px] font-bold tracking-tight text-[#1D1D1F]">Bills Ledger</h2>
          <p class="text-[12px] text-[#86868B] tabular-nums">
            {bills.length} recent receipt(s) · Click any bill to reprint, export PDF, or void
          </p>
        </div>
      </div>

      {bills.length === 0 ? (
        <div class="rounded-[14px] border border-black/[0.06] bg-white p-8 text-center">
          <div class="text-[15px] font-semibold text-[#1D1D1F]">No bills issued yet</div>
          <p class="mt-1 text-[13px] text-[#86868B]">
            Add items in Counter and tap Charge &amp; Print to generate a receipt.
          </p>
        </div>
      ) : (
        <div class="space-y-2">
          {bills.map((b) => (
            <button
              key={b.bill_no}
              type="button"
              onClick={() => {
                activeReceipt.value = b;
              }}
              class="w-full text-left rounded-[14px] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#007AFF]/35 active:scale-[0.99] transition"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="rounded-md bg-[#007AFF]/12 px-2 py-0.5 text-[11px] font-bold text-[#007AFF] tabular-nums">
                    {b.node_id}
                  </span>
                  <span class="truncate text-[14px] font-semibold text-[#1D1D1F] tabular-nums">
                    {b.bill_no}
                  </span>
                  {b.voided && (
                    <span class="rounded-full bg-[#FF3B30]/12 px-2 py-0.5 text-[10px] font-bold text-[#FF3B30]">
                      VOIDED
                    </span>
                  )}
                </div>
                <span
                  class={`text-[16px] font-bold tabular-nums ${
                    b.voided ? "line-through text-[#AEAEB2]" : "text-[#1D1D1F]"
                  }`}
                >
                  {formatMoney(b.total_minor, sym)}
                </span>
              </div>

              <div class="mt-1.5 flex items-center justify-between text-[12px] text-[#86868B] tabular-nums">
                <span>
                  {b.items.length} item(s) · {b.payment_mode}
                </span>
                <span>{b.hlc.slice(0, 19).replace("T", " ")} UTC</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
