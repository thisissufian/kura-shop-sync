import fs from "node:fs";
import path from "node:path";

const manifestPath = path.resolve(
  "src-tauri",
  "gen",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml"
);

const PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CHANGE_WIFI_MULTICAST_STATE",
  "android.permission.CAMERA",
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_SCAN",
];

if (!fs.existsSync(manifestPath)) {
  console.log(`[android:prep] Skipped: ${manifestPath} not found (run "npx tauri android init" first).`);
  process.exit(0);
}

let xml = fs.readFileSync(manifestPath, "utf8");
let added = 0;

const missingLines = PERMISSIONS.filter((p) => !xml.includes(`"${p}"`)).map((p) => {
  added++;
  return `    <uses-permission android:name="${p}" />`;
});

if (missingLines.length > 0) {
  const anchor = xml.indexOf("<application");
  if (anchor === -1) {
    throw new Error("Could not find <application> tag inside AndroidManifest.xml");
  }
  xml = `${xml.slice(0, anchor)}${missingLines.join("\n")}\n\n    ${xml.slice(anchor)}`;
}

if (xml.includes('android:usesCleartextTraffic="false"')) {
  xml = xml.replace('android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="true"');
} else if (!xml.includes("android:usesCleartextTraffic")) {
  xml = xml.replace("<application", '<application\n        android:usesCleartextTraffic="true"');
}

fs.writeFileSync(manifestPath, xml, "utf8");
console.log(
  `[android:prep] Patched ${manifestPath} (+${added} permissions, usesCleartextTraffic="true").`
);

// `tauri android init` writes Tauri's default launcher icon; replace it with Kura's set.
const iconSrc = path.resolve("src-tauri", "icons", "android");
const resDir = path.resolve("src-tauri", "gen", "android", "app", "src", "main", "res");
if (fs.existsSync(iconSrc)) {
  for (const stale of ["drawable/ic_launcher_background.xml", "drawable-v24/ic_launcher_foreground.xml"]) {
    fs.rmSync(path.join(resDir, stale), { force: true });
  }
  fs.cpSync(iconSrc, resDir, { recursive: true });
  console.log(`[android:prep] Copied Kura launcher icons into ${resDir}.`);
}

const gradlePath = path.resolve("src-tauri", "gen", "android", "app", "build.gradle.kts");
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, "utf8");
  // Sign with one stable key (KURA_KEYSTORE_* env vars) so every release installs over the last.
  // Without it, fall back to the debug key, which CI regenerates on every run.
  const releaseSigning =
    'signingConfig = if (System.getenv("KURA_KEYSTORE_PATH") != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")';
  gradle = gradle.replace('signingConfig = signingConfigs.getByName("debug")', releaseSigning);
  if (!gradle.includes(releaseSigning)) {
    gradle = gradle.replace('getByName("release") {', `getByName("release") {\n            ${releaseSigning}`);
  }
  if (!gradle.includes('create("release")')) {
    gradle = gradle.replace(
      "    buildTypes {",
      `    signingConfigs {
        create("release") {
            System.getenv("KURA_KEYSTORE_PATH")?.let { storeFile = file(it) }
            storePassword = System.getenv("KURA_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KURA_KEY_ALIAS")
            keyPassword = System.getenv("KURA_KEY_PASSWORD")
        }
    }
    buildTypes {`
    );
  }
  gradle = gradle.replace(/compileSdk\s*=\s*\d+/, "compileSdk = 36");
  gradle = gradle.replace(/targetSdk\s*=\s*\d+/, "targetSdk = 36");
  fs.writeFileSync(gradlePath, gradle, "utf8");
  console.log(`[android:prep] Patched ${gradlePath} (release signing, compileSdk=36).`);
}

const buildSrcPath = path.resolve("src-tauri", "gen", "android", "buildSrc", "build.gradle.kts");
if (fs.existsSync(buildSrcPath)) {
  let bSrc = fs.readFileSync(buildSrcPath, "utf8");
  if (!bSrc.includes("maven-central.storage-download.googleapis.com")) {
    bSrc = bSrc.replace(
      "repositories {",
      'repositories {\n    maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2/") }'
    );
    fs.writeFileSync(buildSrcPath, bSrc, "utf8");
    console.log(`[android:prep] Patched ${buildSrcPath} (Google Maven Central mirror).`);
  }
}

const rootGradlePath = path.resolve("src-tauri", "gen", "android", "build.gradle.kts");
if (fs.existsSync(rootGradlePath)) {
  let rGradle = fs.readFileSync(rootGradlePath, "utf8");
  if (!rGradle.includes("maven-central.storage-download.googleapis.com")) {
    rGradle = rGradle.replaceAll(
      "repositories {",
      'repositories {\n        maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2/") }'
    );
    fs.writeFileSync(rootGradlePath, rGradle, "utf8");
    console.log(`[android:prep] Patched ${rootGradlePath} (Google Maven Central mirror).`);
  }
}

const settingsPath = path.resolve("src-tauri", "gen", "android", "settings.gradle");
if (fs.existsSync(settingsPath)) {
  let sGrad = fs.readFileSync(settingsPath, "utf8");
  if (!sGrad.includes("pluginManagement")) {
    const pBlock = `pluginManagement {
    repositories {
        maven { url 'https://maven-central.storage-download.googleapis.com/maven2/' }
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

`;
    sGrad = pBlock + sGrad;
    fs.writeFileSync(settingsPath, sGrad, "utf8");
    console.log(`[android:prep] Patched ${settingsPath} (pluginManagement mirror).`);
  }
}
