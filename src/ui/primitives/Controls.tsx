import type { Product } from "../../types/kura";
import { IconBarcodeScan, IconMinus, IconPlus, IconSearch } from "./KuraIcons";

/** Filled search field with an optional trailing scan button. */
export function SearchField({
  id,
  value,
  placeholder,
  onInput,
  onScan,
}: {
  id?: string;
  value: string;
  placeholder: string;
  onInput: (v: string) => void;
  onScan?: () => void;
}) {
  return (
    <div class="relative flex items-center">
      <IconSearch class="absolute left-2.5 w-[18px] h-[18px] text-label-2 pointer-events-none" />
      <input
        id={id}
        type="search"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        class={`kura-input w-full h-10 pl-9 ${onScan ? "pr-11" : "pr-3"} text-body`}
      />
      {onScan && (
        <button type="button" onClick={onScan} title="Scan with camera" aria-label="Scan with camera"
          class="absolute right-1 h-8 w-9 flex items-center justify-center rounded-[8px] text-tint active:opacity-60">
          <IconBarcodeScan class="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/** Horizontally scrolling filter capsules. */
export function ChipRow({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div class="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
      {items.map((c) => (
        <button key={c} type="button" aria-pressed={c === value} onClick={() => onChange(c)} class="kura-chip">
          {c}
        </button>
      ))}
    </div>
  );
}

/** − qty + in a gray capsule (UIStepper proportions, 32 px tall). */
export function QtyStepper({ qty, onChange, canAdd = true }: { qty: number; onChange: (q: number) => void; canAdd?: boolean }) {
  return (
    <div class="inline-flex items-center h-8 rounded-full bg-fill shrink-0">
      <button type="button" aria-label="Remove one" onClick={() => onChange(qty - 1)}
        class="h-8 w-9 flex items-center justify-center text-label active:opacity-50">
        <IconMinus class="w-4 h-4 stroke-[2.2]" />
      </button>
      <span class="min-w-6 text-center text-subhead font-semibold tabular-nums text-label">{qty}</span>
      <button type="button" aria-label="Add one" disabled={!canAdd} onClick={() => onChange(qty + 1)}
        class="h-8 w-9 flex items-center justify-center text-label active:opacity-50 disabled:opacity-30">
        <IconPlus class="w-4 h-4 stroke-[2.2]" />
      </button>
    </div>
  );
}

/** Stock as words + dot: "12 in stock", "Low · 3 left", "Out of stock". */
export function StockStatus({ p }: { p: Product }) {
  const out = p.stock_qty <= 0;
  const low = !out && p.stock_qty <= p.low_stock_threshold;
  const cls = out ? "text-danger" : low ? "text-warning" : "text-label-2";
  return (
    <span class={`inline-flex items-center gap-1.5 tabular-nums ${cls}`}>
      {(out || low) && <span class="kura-dot" />}
      {out ? "Out of stock" : low ? `Low · ${p.stock_qty} left` : `${p.stock_qty} in stock`}
    </span>
  );
}

/** iOS switch (51×31), green when on. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      class={`relative shrink-0 w-[51px] h-[31px] rounded-full transition-colors duration-200 ${on ? "bg-positive-fill" : "bg-[rgba(120,120,128,0.32)]"}`}>
      <span class={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}
