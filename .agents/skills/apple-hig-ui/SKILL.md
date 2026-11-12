---
name: apple-hig-ui
description: Designs and implements Kura's Preact + Signals + Tailwind v4 user interface following Apple Cupertino Human Interface Guidelines and one-handed retail ergonomics. Use whenever creating or modifying .tsx components or CSS styles.
---

# Apple Cupertino Design System for Kura

## Visual & Typography Tokens
- **Canvas Background**: `#F5F5F7`
- **Card / Surface**: `#FFFFFF` with `rounded-[14px]`, `border border-black/[0.06]`, and subtle shadow `0 1px 2px rgba(0,0,0,0.03)`.
- **Glass Bottom Bar & Headers**: `bg-white/80 backdrop-blur-xl border-b border-black/[0.06]`
- **Text Hierarchy**: Primary `#1D1D1F`, Secondary `#86868B`, Muted `#AEAEB2`.
- **Semantic Accents**:
  - Cupertino Blue (`#007AFF`): Active navigation, Sync Chain pulse, primary links.
  - Emerald (`#34C759`): "Charge & Print" button, synced badge.
  - Amber (`#FF9500`): Low stock warning badge.
  - Coral (`#FF3B30`): Out of stock / Void bill action.
- **Tabular Numbers**: Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) on EVERY price, quantity stepper, stock badge, and invoice total.

## Layout & Ergonomics
- **No Blocking Modals**: Never use `alert()` or center-screen modals. All forms (Add Item, QR Pairing, Receipt Preview, Printer Setup) slide up inside a smooth **iOS Spring Bottom Sheet** (`transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)`).
- **One-Handed Counter Flow**: Keep product search, barcode scan trigger, quick category pills, and `+ / -` quantity steppers reachable with one thumb, anchored above a frosted-glass bottom checkout bar.
