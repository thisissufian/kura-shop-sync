<#
.SYNOPSIS
    Binds local SupportingSofts SDKs, Java OpenJDK 17, Android SDK/NDK, and Gradle to the current PowerShell session.
.DESCRIPTION
    Detects offline toolchains in SupportingSofts, configures JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT, NDK_HOME,
    and prepends their binary directories to $env:Path for building Kura Android binaries locally.
#>

[CmdletBinding()]
param()

$root = Split-Path -Parent $PSScriptRoot
$softs = Join-Path $root "SupportingSofts"

if (-not (Test-Path $softs)) {
    Write-Warning "SupportingSofts directory not found at: $softs"
    return
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Kura (蔵) — Local SupportingSofts Toolchain Integrator  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. OpenJDK 17
$jdkPath = Join-Path $softs "AndroidSDK\openjdk"
if (Test-Path (Join-Path $jdkPath "bin\java.exe")) {
    $env:JAVA_HOME = $jdkPath
    $env:Path = "$jdkPath\bin;$env:Path"
    $javaVer = & "$jdkPath\bin\java.exe" -version 2>&1 | Select-Object -First 1
    Write-Host "[OK] JAVA_HOME      : $jdkPath ($javaVer)" -ForegroundColor Green
} else {
    Write-Host "[--] OpenJDK 17     : Not found" -ForegroundColor Yellow
}

# 2. Android SDK & Platform Tools
$sdkPath = Join-Path $softs "AndroidSDK\android-sdk"
if (Test-Path $sdkPath) {
    $env:ANDROID_HOME = $sdkPath
    $env:ANDROID_SDK_ROOT = $sdkPath
    $env:Path = "$sdkPath\platform-tools;$sdkPath\cmdline-tools\latest\bin;$sdkPath\emulator;$env:Path"
    
    if (Test-Path "$sdkPath\platform-tools\adb.exe") {
        $adbVer = & "$sdkPath\platform-tools\adb.exe" version 2>&1 | Select-Object -First 1
        Write-Host "[OK] ANDROID_HOME   : $sdkPath ($adbVer)" -ForegroundColor Green
    } else {
        Write-Host "[OK] ANDROID_HOME   : $sdkPath" -ForegroundColor Green
    }
} else {
    Write-Host "[--] Android SDK    : Not found" -ForegroundColor Yellow
}

# 3. Android NDK
$ndkBase = Join-Path $sdkPath "ndk"
if (Test-Path $ndkBase) {
    $latestNdk = Get-ChildItem -Path $ndkBase -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if ($latestNdk) {
        $env:NDK_HOME = $latestNdk.FullName
        $env:ANDROID_NDK_HOME = $latestNdk.FullName
        Write-Host "[OK] NDK_HOME       : $($latestNdk.FullName) (Version: $($latestNdk.Name))" -ForegroundColor Green
    }
}

# 4. Gradle 8.7
$gradlePath = Join-Path $softs "gradle-8.7"
if (Test-Path (Join-Path $gradlePath "bin\gradle.bat")) {
    $env:GRADLE_HOME = $gradlePath
    $env:Path = "$gradlePath\bin;$env:Path"
    Write-Host "[OK] GRADLE_HOME    : $gradlePath" -ForegroundColor Green
}

# 5. Summary & Verification
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Ready to run: npx tauri android init && npm run android:prep && npx tauri android build" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
