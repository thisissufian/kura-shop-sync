import { useEffect, useState } from "preact/hooks";
import { syncStatus } from "../../state/kuraStore";
import { setThemeMode, themeMode, type ThemeMode } from "../../state/themeStore";
import { shopSettingsSheetOpen } from "../../state/uiSignals";
import { saveShopSettings } from "../../state/vaultConfigActions";
import { FieldRow, Section } from "../primitives/Group";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { SpringSheet } from "../primitives/SpringSheet";

const CURRENCIES = [
  { symbol: "৳", label: "৳ BDT" },
  { symbol: "$", label: "$ USD" },
  { symbol: "€", label: "€ EUR" },
  { symbol: "₹", label: "₹ INR" },
  { symbol: "¥", label: "¥ JPY" },
];

const TIMEZONE_OPTIONS: { offset: number; label: string }[] = [
  { offset: -480, label: "UTC−08:00 · Pacific" },
  { offset: -360, label: "UTC−06:00 · Central" },
  { offset: -300, label: "UTC−05:00 · Eastern" },
  { offset: 0, label: "UTC+00:00 · London / UTC" },
  { offset: 60, label: "UTC+01:00 · Berlin / Lagos" },
  { offset: 180, label: "UTC+03:00 · Riyadh / Nairobi" },
  { offset: 240, label: "UTC+04:00 · Dubai" },
  { offset: 300, label: "UTC+05:00 · Karachi" },
  { offset: 330, label: "UTC+05:30 · India / Colombo" },
  { offset: 345, label: "UTC+05:45 · Kathmandu" },
  { offset: 360, label: "UTC+06:00 · Dhaka (Bangladesh)" },
  { offset: 390, label: "UTC+06:30 · Yangon" },
  { offset: 420, label: "UTC+07:00 · Bangkok / Jakarta" },
  { offset: 480, label: "UTC+08:00 · Singapore / KL" },
  { offset: 540, label: "UTC+09:00 · Tokyo / Seoul" },
  { offset: 600, label: "UTC+10:00 · Sydney" },
  { offset: 720, label: "UTC+12:00 · Auckland" },
];

export function ShopSettingsSheet() {
  const open = shopSettingsSheetOpen.value;
  const status = syncStatus.value;

  const [shopName, setShopName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [currency, setCurrency] = useState("$");
  const [footer, setFooter] = useState("");
  const [utcOffset, setUtcOffset] = useState(360);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !status) return;
    setShopName(status.shop_name);
    setSubtitle(status.shop_subtitle ?? "");
    setCurrency(status.currency_symbol || "$");
    setFooter(status.receipt_footer || "Thank you for shopping!");
    setUtcOffset(status.utc_offset_minutes ?? 360);
  }, [open, status]);

  const close = () => {
    shopSettingsSheetOpen.value = false;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    const ok = await saveShopSettings({
      shop_name: shopName.trim(),
      shop_subtitle: subtitle.trim(),
      currency_symbol: currency,
      receipt_footer: footer.trim() || "Thank you for shopping!",
      utc_offset_minutes: utcOffset,
    });
    setSaving(false);
    if (ok) close();
  };

  const v = (fn: (x: string) => void) => (e: Event) => fn((e.target as HTMLInputElement).value);
  const hm = (o: number) => `${String(Math.floor(Math.abs(o) / 60)).padStart(2, "0")}:${String(Math.abs(o) % 60).padStart(2, "0")}`;

  return (
    <SpringSheet open={open} title="Shop settings" subtitle="Synced to every linked phone" onClose={close}>
      <form onSubmit={handleSubmit} class="space-y-6">
        <Section header="Shop">
          <FieldRow label="Name">
            <input required value={shopName} onInput={v(setShopName)} class="kura-field" />
          </FieldRow>
          <FieldRow label="Address line">
            <input placeholder="42 Main Rd · 01700-000000" value={subtitle} onInput={v(setSubtitle)} class="kura-field" />
          </FieldRow>
        </Section>

        <Section header="Receipts" footer="The address line and footer print on every receipt.">
          <FieldRow label="Currency">
            <select value={currency} onChange={(e) => setCurrency((e.target as HTMLSelectElement).value)} class="kura-field">
              {CURRENCIES.map((c) => (<option key={c.symbol} value={c.symbol}>{c.label}</option>))}
            </select>
          </FieldRow>
          <FieldRow label="Footer">
            <input placeholder="Thank you for shopping!" value={footer} onInput={v(setFooter)} class="kura-field" />
          </FieldRow>
          <FieldRow label="Time zone">
            <select value={utcOffset} onChange={(e) => setUtcOffset(Number((e.target as HTMLSelectElement).value))} class="kura-field tabular-nums">
              {!TIMEZONE_OPTIONS.some((o) => o.offset === utcOffset) && (
                <option value={utcOffset}>UTC{utcOffset >= 0 ? "+" : "−"}{hm(utcOffset)}</option>
              )}
              {TIMEZONE_OPTIONS.map((o) => (<option key={o.offset} value={o.offset}>{o.label}</option>))}
            </select>
          </FieldRow>
        </Section>

        <section>
          <div class="kura-section-header">Appearance on this phone</div>
          <SegmentedControl
            options={[
              { id: "SYSTEM" as ThemeMode, label: "Automatic" },
              { id: "LIGHT" as ThemeMode, label: "Light" },
              { id: "DARK" as ThemeMode, label: "Dark" },
            ]}
            value={themeMode.value}
            onChange={setThemeMode}
          />
        </section>

        <button type="submit" disabled={saving} class="kura-btn kura-btn-filled kura-btn-lg w-full">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </SpringSheet>
  );
}
