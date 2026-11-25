import { useEffect, useRef, useState } from "preact/hooks";
import {
  cart,
  editingProduct,
  joinChain,
  products,
  productSheetOpen,
  setCartQty,
  showToast,
} from "../../state/kuraStore";
import { tryOpenBillByScan } from "../../state/parkedCarts";
import { scannedBarcodePrefill, scannerMode } from "../../state/uiSignals";
import { SpringSheet } from "../primitives/SpringSheet";
import { playCheckoutChime, playScanBeep, playWarningTone } from "../utils/posAudio";

interface BarcodeResult {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

export function ScannerSheet() {
  const mode = scannerMode.value;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [camStatus, setCamStatus] = useState("Initializing camera…");
  const lastHitRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });

  const close = () => {
    scannerMode.value = null;
    setManualCode("");
  };

  const handleDetected = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (lastHitRef.current.code === code && now - lastHitRef.current.ts < 1400) {
      return;
    }
    lastHitRef.current = { code, ts: now };

    if (mode === "QR_PAIRING") {
      if (code.startsWith("kura://join?")) {
        playCheckoutChime();
        close();
        await joinChain(code);
      } else {
        playWarningTone();
        showToast("Not a valid kura://join QR code", "err");
      }
      return;
    }

    if (mode === "BARCODE_PREFILL") {
      playScanBeep();
      scannedBarcodePrefill.value = code;
      editingProduct.value = null;
      close();
      productSheetOpen.value = true;
      return;
    }

    if (await tryOpenBillByScan(code)) return;

    const q = code.toLowerCase();
    const match = products.value.find(
      (p) => (p.barcode ?? "").toLowerCase() === q || p.sku.toLowerCase() === q
    );
    if (match) {
      playScanBeep();
      const qty = cart.value[match.sku] ?? 0;
      setCartQty(match.sku, qty + 1);
      showToast(`Scanned +1 ${match.name}`);
      if (match.stock_qty - (qty + 1) <= match.low_stock_threshold) {
        playWarningTone();
      }
      close();
    } else {
      playWarningTone();
      showToast(`Unknown barcode: ${code}`, "err");
    }
  };

  useEffect(() => {
    if (!mode) return;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamStatus("Camera unavailable — use manual entry below");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (!window.BarcodeDetector) {
          setCamStatus("Live viewfinder active (use manual box if BarcodeDetector unsupported)");
          return;
        }
        setCamStatus(
          mode === "QR_PAIRING"
            ? "Point camera at a Kura Sync QR code"
            : "Align barcode inside frame"
        );
        const detector = new window.BarcodeDetector({ formats: FORMATS });
        const tick = async () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2) {
            try {
              const hits = await detector.detect(v);
              if (hits.length > 0 && hits[0].rawValue) {
                await handleDetected(hits[0].rawValue);
              }
            } catch {
              // ignore frame errors
            }
          }
          rafId = requestAnimationFrame(() => void tick());
        };
        rafId = requestAnimationFrame(() => void tick());
      } catch {
        setCamStatus("Camera permission denied or missing — use manual entry");
      }
    };

    void start();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  return (
    <SpringSheet
      open={Boolean(mode)}
      title={mode === "QR_PAIRING" ? "Scan pairing QR" : "Scan barcode"}
      subtitle={camStatus}
      onClose={close}
    >
      <div class="space-y-4">
        <div class="relative overflow-hidden rounded-group bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            class="h-full w-full object-cover"
          />
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="relative h-40 w-56 rounded-[14px] border-[1.5px] border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] overflow-hidden">
              <div class="kura-scan-line absolute inset-x-3 h-[1.5px] rounded-full bg-white/80" />
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleDetected(manualCode);
          }}
          class="flex gap-2"
        >
          <input
            value={manualCode}
            onInput={(e) => setManualCode((e.target as HTMLInputElement).value)}
            placeholder={
              mode === "QR_PAIRING"
                ? "Or paste a kura://join link"
                : "Or type the barcode"
            }
            class="kura-input flex-1 min-w-0 h-11 px-3.5 text-body tabular-nums"
          />
          <button
            type="submit"
            class="kura-btn kura-btn-filled"
          >
            Find
          </button>
        </form>
      </div>
    </SpringSheet>
  );
}
