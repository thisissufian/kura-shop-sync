interface SegmentOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      class="inline-flex w-full rounded-xl kura-subtle p-1"
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            class={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-200 ${
              active
                ? "kura-card kura-text-main shadow-xs"
                : "kura-text-muted hover:kura-text-main"
            }`}
          >
            <span class="truncate">{opt.label}</span>
            {typeof opt.badge === "number" && opt.badge > 0 && (
              <span class="tabular-nums rounded-full bg-[#007AFF]/12 px-1.5 py-0.2 text-[11px] font-semibold text-[#007AFF]">
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
