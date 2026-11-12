import { useEffect, useState } from "preact/hooks";
import { syncStatus } from "../../state/kuraStore";
import { setThemeMode, themeMode, type ThemeMode } from "../../state/themeStore";
import { shopSettingsSheetOpen } from "../../state/uiSignals";
import { saveShopSettings } from "../../state/vaultConfigActions";
import { SpringSheet } from "../primitives/SpringSheet";

const CURRENCIES = [
  { symbol: "৳", label: "৳ BDT" },
  { symbol: "$", label: "$ USD" },
  { symbol: "€", label: "€ EUR" },
  { symbol: "₹", label: "₹ INR" },
  { symbol: "¥", label: "¥ JPY" },
];

export function ShopSettingsSheet() {
  const open = shopSettingsSheetOpen.value;
  const status = syncStatus.value;

  const [shopName, setShopName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [currency, setCurrency] = useState("$");
  const [footer, setFooter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !status) return;
    setShopName(status.shop_name);
    setSubtitle(status.shop_subtitle ?? "");
    setCurrency(status.currency_symbol || "$");
    setFooter(status.receipt_footer || "Thank you for shopping!");
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
    });
    setSaving(false);
    if (ok) close();
  };

  return (
    <SpringSheet
      open={open}
      title="Shop Profile & Receipts"
      subtitle="Synced automatically across all linked phones"
      onClose={close}
    >
      <form onSubmit={handleSubmit} class="space-y-3.5">
        <div class="rounded-[14px] border border-black/[0.06] bg-white p-3.5 space-y-3">
          <label class="block">
            <span class="text-[11px] font-medium text-[#86868B]">Shop Name</span>
            <input
              required
              value={shopName}
              onInput={(e) => setShopName((e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[14px]"
            />
          </label>

          <label class="block">
            <span class="text-[11px] font-medium text-[#86868B]">
              Address / Phone Subtitle (Receipts)
            </span>
            <input
              placeholder="e.g. 42 Main Rd · +880 1700-000000"
              value={subtitle}
              onInput={(e) => setSubtitle((e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[13px]"
            />
          </label>

          <div>
            <span class="text-[11px] font-medium text-[#86868B]">Currency Symbol</span>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              {CURRENCIES.map((c) => {
                const active = currency === c.symbol;
                return (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => setCurrency(c.symbol)}
                    class={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                      active
                        ? "bg-[#007AFF] text-white"
                        : "bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.06]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label class="block">
            <span class="text-[11px] font-medium text-[#86868B]">Receipt Footer</span>
            <input
              placeholder="Thank you for shopping!"
              value={footer}
              onInput={(e) => setFooter((e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-[13px]"
            />
          </label>

          <div>
            <span class="text-[11px] font-medium text-[#86868B]">Display Appearance</span>
            <div class="mt-1.5 flex gap-1.5">
              {(
                [
                  { id: "LIGHT", label: "Light" },
                  { id: "DARK", label: "OLED Dark" },
                  { id: "SYSTEM", label: "Auto" },
                ] as { id: ThemeMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setThemeMode(m.id)}
                  class={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition ${
                    themeMode.value === m.id
                      ? "bg-[#1D1D1F] text-white"
                      : "bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.06]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          class="w-full rounded-[14px] bg-[#007AFF] py-3.5 text-[15px] font-semibold text-white shadow-sm hover:brightness-105 active:scale-[0.99] disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save & Sync Shop Profile"}
        </button>
      </form>
    </SpringSheet>
  );
}
