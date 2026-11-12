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
      title={mode === "QR_PAIRING" ? "Scan Sync Chain QR" : "Scan Barcode"}
      subtitle={camStatus}
      onClose={close}
    >
      <div class="space-y-3.5">
        <div class="relative overflow-hidden rounded-[16px] bg-[#1D1D1F] aspect-[4/3] border border-black/10">
          <video
            ref={videoRef}
            playsInline
            muted
            class="h-full w-full object-cover"
          />
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div class="relative h-40 w-56 rounded-[16px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] overflow-hidden">
              <div class="kura-scan-line absolute inset-x-2 h-0.5 bg-[#007AFF] shadow-[0_0_8px_#007AFF]" />
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
                ? "Paste or simulate kura://join?... URI"
                : "Type/simulate barcode (e.g. 890101001010)"
            }
            class="flex-1 rounded-[12px] border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] tabular-nums"
          />
          <button
            type="submit"
            class="rounded-[12px] bg-[#007AFF] px-4 py-2.5 text-[13px] font-semibold text-white active:scale-95 transition"
          >
            Match
          </button>
        </form>
      </div>
    </SpringSheet>
  );
}
