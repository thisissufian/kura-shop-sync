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
