import type { ComponentChildren } from "preact";
import { IconChevronRight } from "./KuraIcons";

/** Inset grouped section: optional header/footer around a rounded list. */
export function Section({
  header,
  footer,
  trailing,
  children,
  class: cls = "",
  inset,
}: {
  header?: ComponentChildren;
  footer?: ComponentChildren;
  trailing?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
  /** separator inset in px (e.g. 60 when rows lead with an icon) */
  inset?: number;
}) {
  return (
    <section class={cls}>
      {(header || trailing) && (
        <div class="kura-section-header flex items-end justify-between gap-3">
          <span>{header}</span>
          {trailing}
        </div>
      )}
      <div class="kura-group" style={inset ? `--kura-sep-inset:${inset}px` : undefined}>
        {children}
      </div>
      {footer && <p class="kura-section-footer">{footer}</p>}
    </section>
  );
}

/** A label/value row. Pass onClick to make it a tappable button with a chevron. */
export function Row({
  label,
  detail,
  value,
  valueClass = "text-label-2",
  leading,
  onClick,
  chevron,
  children,
}: {
  label?: ComponentChildren;
  detail?: ComponentChildren;
  value?: ComponentChildren;
  valueClass?: string;
  leading?: ComponentChildren;
  onClick?: () => void;
  chevron?: boolean;
  children?: ComponentChildren;
}) {
  const inner = (
    <>
      {leading}
      {(label || detail) && (
        <div class="min-w-0 flex-1">
          {label && <div class="text-body text-label truncate">{label}</div>}
          {detail && <div class="text-footnote text-label-2 truncate">{detail}</div>}
        </div>
      )}
      {children}
      {value !== undefined && <span class={`text-body tabular-nums shrink-0 ${valueClass}`}>{value}</span>}
      {(chevron ?? Boolean(onClick)) && <IconChevronRight class="w-4 h-4 text-label-3 shrink-0 -mr-1" />}
    </>
  );
  return onClick ? (
    <button type="button" class="kura-row" onClick={onClick}>{inner}</button>
  ) : (
    <div class="kura-row">{inner}</div>
  );
}

/** Form row: label on the leading edge, borderless control on the trailing edge. */
export function FieldRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="kura-row cursor-text">
      <span class="text-body text-label shrink-0">{label}</span>
      {children}
    </label>
  );
}

/** Large-title page header with an optional subtitle and trailing actions. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ComponentChildren;
  children?: ComponentChildren;
}) {
  return (
    <div class="flex items-end justify-between gap-3 pt-2">
      <div class="min-w-0">
        <h1 class="text-large-title font-bold text-label">{title}</h1>
        {subtitle && <p class="text-subhead text-label-2 tabular-nums mt-0.5">{subtitle}</p>}
      </div>
      {children && <div class="flex items-center gap-2 shrink-0 pb-1">{children}</div>}
    </div>
  );
}
