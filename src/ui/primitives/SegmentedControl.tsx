interface SegmentOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  class?: string;
}

/** iOS segmented control: fill track, raised thumb on the selected segment. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  class: cls = "",
}: SegmentedControlProps<T>) {
  return (
    <div class={`flex w-full rounded-[9px] bg-fill p-[2px] ${cls}`} role="tablist">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            class={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-[7px] px-3 min-h-[30px] text-footnote transition-[background-color,box-shadow] duration-200 ${
              active
                ? "bg-thumb text-label font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]"
                : "text-label font-medium"
            }`}
          >
            <span class="truncate">{opt.label}</span>
            {typeof opt.badge === "number" && opt.badge > 0 && (
              <span class="tabular-nums text-label-2">{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
