# SupportingSofts Toolchain & Environment Audit Report

**Location:** `F:\cool projects\Kura - Shop Stock & Bill Sync\SupportingSofts`  
**Git Status:** Completely ignored via `.gitignore` (`SupportingSofts/`) to safeguard repository clone speed and avoid tracking multi-gigabyte binary assets.

---

## 1. Executive Summary

`SupportingSofts` contains a self-contained, offline-ready Android and Java development ecosystem. It allows building, testing, and debugging Kura's Android native APK and Play Store AAB builds directly on a Windows workstation without downloading massive external dependencies.

The directory is bridged to the developer's PowerShell session via `scripts/use-supporting-softs.ps1`, which dynamically binds `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, and `GRADLE_HOME`.

---

## 2. Inventory of Toolchains & Components

| Component / Subdirectory | Version / Details | Size / Footprint | Purpose in Kura Architecture |
| :--- | :--- | :--- | :--- |
| **`AndroidSDK/openjdk/`** | OpenJDK 17.0.18 LTS (build 17.0.18+8-LTS, Microsoft distribution) | ~340 MB (unpacked) / 178 MB (`openjdk-17.zip`) | Required by Gradle and the Android Gradle Plugin (AGP) for compiling Java/Kotlin bindings in `src-tauri/gen/android`. Sets `JAVA_HOME`. |
| **`AndroidSDK/android-sdk/`** | Android SDK 33, 34, 35, 36 | Multi-GB | Core Android SDK containing platform libraries, Google Play Services APIs, and system emulator images. Sets `ANDROID_HOME`. |
| **`AndroidSDK/android-sdk/ndk/`** | NDK `28.2.13676358` | ~2.4 GB | Native Development Kit for cross-compiling Kura's Rust core (`src-tauri/src/`) for ARM64 (`aarch64-linux-android`) and ARMv7. Sets `NDK_HOME`. |
| **`AndroidSDK/android-sdk/build-tools/`** | Build Tools `34.0.0`, `35.0.0` | ~120 MB | `aapt2`, `d8`, `zipalign`, and `apksigner` used to assemble, optimize, and sign `.apk` and `.aab` packages. |
| **`AndroidSDK/android-sdk/platform-tools/`** | ADB version `1.0.41` (v36.0.2) | ~25 MB | `adb.exe` for local device mirroring, APK side-loading, logcat inspection, and Android Virtual Device (AVD) management. |
| **`AndroidSDK/android-sdk/emulator/`** | Android Emulator | ~500 MB | Runs x86_64 and ARM64 Android Virtual Devices locally for end-to-end POS UI verification. |
| **`gradle-8.7/`** | Gradle 8.7 Distribution | ~150 MB / 128 MB (`gradle-8.7-bin.zip`) | Standalone Gradle build daemon used to compile Tauri v2 Android projects. Sets `GRADLE_HOME`. |
| **`AndroidSDK/flutter/`** | Flutter SDK | ~1.5 GB | Legacy framework dependency from previous projects; not required for Kura's pure Tauri v2 + Preact architecture. |
| **`Unity Hub/`** | Unity Hub | Variable | Independent development tool; excluded from Kura builds. |

---

## 3. Automation Scripts Discovered & Their Roles

`SupportingSofts` contains several diagnostic and helper scripts from prior workflows:
- `setup_env.ps1` & `check_status.ps1`: Environment check scripts.
- `create_avd.ps1` & `launch_emulator.ps1`: Create and boot Android virtual devices.
- `fix_adb_path.ps1`: Updates PATH with platform-tools.
- `generate_icons.ps1`: Icon processing script.
- `app-release-arm64-20260221-1431.apk` & `yapr-release-20260625-0217.apk`: Pre-existing reference builds (~22 MB and ~58 MB).

---

## 4. How to Use with Kura

To activate these local tools for compiling Kura Android builds:

```powershell
# 1. Run the bridge script in your active PowerShell terminal:
. .\scripts\use-supporting-softs.ps1

# 2. Verify that java, adb, and gradle are on PATH:
java -version
adb version

# 3. Initialize and build Kura Android:
npx tauri android init
npm run android:prep
npx tauri android build --apk --aab
```

This local toolchain guarantees fast, reproducible builds offline without requiring internet access to download Android SDK components.
