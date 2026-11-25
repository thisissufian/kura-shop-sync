---
name: apple-hig-ui
description: Designs and implements Kura's Preact + Signals + Tailwind v4 user interface following Apple Human Interface Guidelines and one-handed retail ergonomics. Use whenever creating or modifying .tsx components or CSS styles.
---

# Kura UI: Apple HIG design system

The look is a "Settings app for a shop counter". It is calm, grouped and typographic, and it has a single tint. If a screen looks like a generic dashboard template (gradient hero, rainbow tiles, colored pills everywhere), it is wrong.

## Where the tokens live
- `src/index.css` imports `src/styles/tokens.css` (the CSS variables and the Tailwind `@theme` bridge) and `src/styles/components.css` (the component classes).
- Light values live on `:root`; dark values on `[data-theme="dark"]`. `themeStore.ts` sets `data-theme`.
- `@custom-variant dark` is bound to `data-theme`, so `dark:` utilities follow the in-app theme. Prefer semantic tokens over `dark:` anyway.
- **Never hard-code hex colors in components.** Use the Tailwind token utilities:

| Purpose | Utility | Light / Dark |
|---|---|---|
| Page background | `bg-canvas` | #F2F2F7 / #000 |
| Grouped row surface | `bg-surface` (`.kura-group`) | #FFF / #1C1C1E (#2C2C2E inside sheets) |
| Sheet background | `bg-sheet` | #F2F2F7 / #1C1C1E |
| Control fill | `bg-fill` | tertiarySystemFill |
| Text | `text-label`, `text-label-2`, `text-label-3` | label / secondary / tertiary |
| Separator | `border-sep` | separator |
| Tint (interactive only) | `text-tint`, `bg-tint` | #007AFF / #0A84FF |
| Money in, success | `text-positive`, `bg-positive-fill` | #248A3D (accessible) / #30D158 |
| Owed, low stock | `text-warning`, `bg-warning-fill` | #C93400 / #FF9F0A |
| Destructive, out of stock | `text-danger`, `bg-danger-fill` | #D70015 / #FF453A |

Only these meanings are allowed. No purple, teal or WhatsApp green, and never use one color to mean two things.

## Type scale (iOS Dynamic Type defaults)
- Size utilities: `text-large-title` 34/41 (always `font-bold`), `text-title1` 28, `text-title2` 22, `text-title3` 20, `text-headline` 17 semibold, `text-body` 17, `text-callout` 16, `text-subhead` 15, `text-footnote` 13, `text-caption` 12, `text-caption2` 11.
- Nothing smaller than 11 px. Use sentence case; avoid UPPERCASE labels and tracking-wide.
- Put `tabular-nums` on every price, quantity, stock count and total.
- Big money figures use `text-[40px] font-bold tracking-tight` (Wallet style).

## Layout
- Each tab starts with `<PageHeader title=… subtitle=…>` (a Large Title, with trailing actions).
- Content goes in **inset grouped sections**: `<Section header footer>` + `<Row label detail value onClick>` from `ui/primitives/Group.tsx`. Rows are at least 44 px tall. Separators are hairlines inset 16 px (pass `inset={60}` when rows lead with an icon). A row that drills in gets a chevron.
- Forms use `<FieldRow label>` with `.kura-field` inputs: borderless and right-aligned, like iOS Settings. Free-standing inputs such as search use `.kura-input` (filled, no border).
- Use a 16 px page gutter and 28 px (`space-y-7`) between sections. Radii are `rounded-group` 12, `rounded-control` 10 and `rounded-sheet` 16.
- Navigation: `BottomNavDock` is a standard 5-item tab bar below 1024 px. It is monochrome, tint on the selected item, with a red badge only for the cart count and no elevated center button. `SidebarNav` is an iPadOS sidebar at 1024 px and up. `TopBar` is a material nav bar with round gray toolbar icon buttons.

## Controls
- Buttons: `.kura-btn` plus one of `-filled` (one or two per view: Charge, Save), `-gray` / `-tinted` (secondary), `-plain` (text), `-destructive` (red on red tint) or `-danger-filled` (the confirm step only). Sizes: `-sm` (32 px capsule), default (44 px), `-lg` (50 px, full-width primary in sheets).
- `.kura-icon-btn` is a 36 px round gray button with a tint glyph. `.kura-chip` + `aria-pressed` is a filter capsule. `SegmentedControl` has a fill track and a raised thumb.
- Status is shown as text, or as `.kura-dot` + text. Do not use colored pill badges.
- Icons come from `KuraIcons.tsx` only (1.8 px stroke SVG). **No emoji or unicode arrows (➔ ✕ ▲ ● ⇄) as icons.**

## Sheets
- `SpringSheet` has a grabber on phones, a centered title and subtitle, a round × close at top-trailing, and Esc to close. It is elevated: `.kura-elevated` makes the groups inside it #2C2C2E in dark mode.
- Form sheets keep one full-width `kura-btn-lg kura-btn-filled` primary action at the bottom. Destructive confirmation happens inline, in two steps.
- No `alert()` and no center modals on phones.

## Dark mode
- It is designed, not inverted. The base is pure black; grouped surfaces are #1C1C1E; elevated sheets are #1C1C1E with #2C2C2E groups. Colors use their dark variants. The receipt paper stays light (#EBEBF0) because it represents paper.
- Check every screen in both themes at 375 px and 1280 px.

## Ergonomics
- On phones, the register checkout sits above the tab bar as a material bar: total plus a large Charge button within thumb reach. Steppers are − / + in a gray capsule. The "Add" button is a gray capsule with a tint label (App Store "Get" style).
