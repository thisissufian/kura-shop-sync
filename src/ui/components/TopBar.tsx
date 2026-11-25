import { currencySymbol, formatMoney, isOwner, isTauriRuntime, syncStatus } from "../../state/kuraStore";
import { totalDueMinor } from "../../state/customerActions";
import { cycleThemeMode, isDarkTheme, themeMode } from "../../state/themeStore";
import { drawerSheetOpen, khataSheetOpen, remoteRelayConnected, shopSettingsSheetOpen } from "../../state/uiSignals";
import { KuraBrandMark } from "../primitives/KuraBrandMark";
import {
  IconBell,
  IconBellSlash,
  IconCashDrawer,
  IconMoon,
  IconPerson,
  IconSun,
  IconUsersDue,
} from "../primitives/KuraIcons";
import { audioMuted, toggleAudioMute } from "../utils/posAudio";

/** Navigation bar: shop identity on the leading edge, toolbar actions on the trailing edge. */
export function TopBar() {
  const status = syncStatus.value;
  const owner = status?.role === "OWNER";
  const online = (status?.peer_count ?? 0) > 0;
  const openSettings = () => { if (isOwner.value) shopSettingsSheetOpen.value = true; };

  const toggleRole = () => {
    if (!syncStatus.value) return;
    const next = syncStatus.value.role === "OWNER" ? "CASHIER" : "OWNER";
    syncStatus.value = { ...syncStatus.value, role: next };
  };

  return (
    <header class="sticky top-0 z-30 kura-glass-bar kura-hairline-b kura-safe-top">
      <div class="mx-auto max-w-5xl h-[52px] px-4 flex items-center justify-between gap-3">
        <button type="button" onClick={openSettings} title={isOwner.value ? "Shop profile & settings" : undefined}
          class="flex items-center gap-2.5 min-w-0 text-left lg:invisible">
          <span class="hidden sm:block"><KuraBrandMark /></span>
          <span class="min-w-0">
            <span class="block text-headline font-semibold text-label truncate">{status?.shop_name ?? "Kura Store"}</span>
            <span class="flex items-center gap-1.5 text-caption text-label-2 tabular-nums">
              <span class={`kura-dot ${online ? "text-positive-fill" : "text-label-3"}`} />
              <span>{status?.node_id ?? "K1"}<span class="sm:hidden"> · {owner ? "Owner" : "Cashier"}</span></span>
              <span class="hidden sm:inline">{online ? `· ${status?.peer_count} linked` : "· Offline-ready"}</span>
              {remoteRelayConnected.value && <span class="text-positive">· Live</span>}
              {!isTauriRuntime && <span class="hidden sm:inline">· Web preview</span>}
            </span>
          </span>
        </button>

        <div class="flex items-center gap-1 sm:gap-1.5 shrink-0 [&>button]:max-sm:!w-8 [&>button]:max-sm:!h-8 [&>button]:max-sm:!px-0">
          <button type="button" onClick={() => { khataSheetOpen.value = true; }} title="Customer dues (khata)"
            class="kura-icon-btn sm:!w-auto sm:px-3 sm:gap-1.5">
            <IconUsersDue class="w-[18px] h-[18px]" />
            <span class="hidden sm:inline text-subhead font-medium tabular-nums">
              {formatMoney(totalDueMinor.value, currencySymbol.value)}
            </span>
          </button>
          <button type="button" onClick={() => { drawerSheetOpen.value = true; }} title="Cash drawer & expenses"
            class="kura-icon-btn sm:!w-auto sm:px-3 sm:gap-1.5">
            <IconCashDrawer class="w-[18px] h-[18px]" />
            <span class="hidden sm:inline text-subhead font-medium">Till</span>
          </button>
          <button type="button" onClick={toggleAudioMute} title={audioMuted.value ? "Unmute sounds" : "Mute sounds"}
            aria-pressed={audioMuted.value} class="kura-icon-btn">
            {audioMuted.value ? <IconBellSlash class="w-[18px] h-[18px]" /> : <IconBell class="w-[18px] h-[18px]" />}
          </button>
          <button type="button" onClick={cycleThemeMode} title={`Appearance: ${themeMode.value.toLowerCase()} (tap to change)`}
            class="kura-icon-btn">
            {isDarkTheme.value ? <IconMoon class="w-[18px] h-[18px]" /> : <IconSun class="w-[18px] h-[18px]" />}
          </button>
          <button type="button" onClick={toggleRole} title="Switch between Owner and Cashier"
            class="kura-icon-btn !w-auto px-2.5 gap-1 text-subhead font-medium">
            <IconPerson class="w-[18px] h-[18px]" />
            <span class="hidden sm:inline">{owner ? "Owner" : "Cashier"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
