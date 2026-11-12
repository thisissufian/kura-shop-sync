import {
  activeReceipt,
  activeTab,
  cart,
  cartCount,
  chargeAndIssueBill,
  editingProduct,
  products,
  productSheetOpen,
  setCartQty,
  showToast,
} from "../../state/kuraStore";
import { BILL_NO_RE, holdCurrentCart, tryOpenBillByScan } from "../../state/parkedCarts";
import {
  csvSheetOpen,
  drawerSheetOpen,
  khataSheetOpen,
  scannerMode,
  shopSettingsSheetOpen,
} from "../../state/uiSignals";
import { playWarningTone } from "./posAudio";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function closeAnySheet(): boolean {
  if (scannerMode.value) {
    scannerMode.value = null;
    return true;
  }
  if (activeReceipt.value) {
    activeReceipt.value = null;
    return true;
  }
  if (productSheetOpen.value) {
    productSheetOpen.value = false;
    editingProduct.value = null;
    return true;
  }
  if (shopSettingsSheetOpen.value) {
    shopSettingsSheetOpen.value = false;
    return true;
  }
  if (khataSheetOpen.value) {
    khataSheetOpen.value = false;
    return true;
  }
  if (drawerSheetOpen.value) {
    drawerSheetOpen.value = false;
    return true;
  }
  if (csvSheetOpen.value) {
    csvSheetOpen.value = false;
    return true;
  }
  return false;
}

export function attachPosHotkeys(): () => void {
  let buf = "";
  let lastTs = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    const now = performance.now();
    const typing = isTypingTarget(e.target);

    if (e.key === "Escape") {
      if (closeAnySheet()) e.preventDefault();
      return;
    }

    if (e.key === "F2") {
      e.preventDefault();
      scannerMode.value = scannerMode.value ? null : "BARCODE_CART";
      return;
    }

    if (e.key === "F4") {
      e.preventDefault();
      if (cartCount.value > 0) void chargeAndIssueBill();
      return;
    }

    if (e.key === "F6") {
      e.preventDefault();
      holdCurrentCart();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      activeTab.value = "counter";
      requestAnimationFrame(() => {
        document.getElementById("kura-counter-search")?.focus();
      });
      return;
    }

    if (!typing && e.key === "/") {
      e.preventDefault();
      activeTab.value = "counter";
      requestAnimationFrame(() => {
        document.getElementById("kura-counter-search")?.focus();
      });
      return;
    }

    if (typing) return;

    if (e.key === "Enter") {
      if (buf.length >= 4 && now - lastTs <= 80) {
        e.preventDefault();
        const raw = buf.trim();
        buf = "";
        if (BILL_NO_RE.test(raw)) {
          void tryOpenBillByScan(raw);
          return;
        }
        const code = raw.toLowerCase();
        const match = products.value.find(
          (p) => (p.barcode ?? "").toLowerCase() === code || p.sku.toLowerCase() === code
        );
        if (match) {
          setCartQty(match.sku, (cart.value[match.sku] ?? 0) + 1);
          showToast(`HID Scan +1 ${match.name}`);
        } else {
          playWarningTone();
          showToast(`No SKU/barcode match: ${code}`, "err");
        }
      } else {
        buf = "";
      }
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      buf = now - lastTs <= 35 ? buf + e.key : e.key;
      lastTs = now;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
