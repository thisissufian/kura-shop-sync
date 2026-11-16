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

const gradlePath = path.resolve("src-tauri", "gen", "android", "app", "build.gradle.kts");
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, "utf8");
  if (!gradle.includes('signingConfig = signingConfigs.getByName("debug")')) {
    gradle = gradle.replace(
      'getByName("release") {',
      'getByName("release") {\n            signingConfig = signingConfigs.getByName("debug")'
    );
  }
  gradle = gradle.replace(/compileSdk\s*=\s*\d+/, "compileSdk = 36");
  gradle = gradle.replace(/targetSdk\s*=\s*\d+/, "targetSdk = 36");
  fs.writeFileSync(gradlePath, gradle, "utf8");
  console.log(`[android:prep] Patched ${gradlePath} (debug signing for release APK, compileSdk=36).`);
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
