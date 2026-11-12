---
name: camera-scanner-audio
description: Implements Kura's zero-dependency camera barcode/QR scanner using the native BarcodeDetector API and synthesizes tactile POS audio feedback (scan beep, Apple Pay-style checkout chime, error buzz) using Web Audio API OscillatorNode.
---

# Native Camera Scanner & WebAudio Tactile Protocol

## 1. Zero-KB POS Sound Synthesizer (`src/ui/utils/posAudio.ts`)
Use `window.AudioContext` (`OscillatorNode` + `GainNode` with exponential ramp decay) to synthesize three subtle, tactile sounds with 0 bytes of external audio assets:
- `playScanBeep()`: Crisp 1200Hz sine/triangle blip (60ms) when a barcode/QR is detected or item is tapped.
- `playCheckoutChime()`: Warm two-note ascending major fifth chime (C6 -> G6, 180ms) inspired by Apple Pay success when a bill is issued.
- `playWarningTone()`: Soft low double-tone (280Hz, 120ms) on low stock or invalid input.

## 2. Camera Barcode & QR Scanner (`src/ui/sheets/ScannerSheet.tsx`)
- Request rear camera (`facingMode: 'environment'`) via `navigator.mediaDevices.getUserMedia`.
- Use native `window.BarcodeDetector` supporting formats `['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']`.
- Always include a clean manual code entry / simulation input bar inside the Scanner Sheet so desktop PCs without a rear camera or browsers without `BarcodeDetector` can test scanning seamlessly.
- Stop all camera media tracks (`stream.getTracks().forEach(t => t.stop())`) immediately when the sheet closes.
