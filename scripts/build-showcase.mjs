import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distAppDir = path.join(rootDir, "dist");
const websiteDir = path.join(rootDir, "website");
const outDir = path.join(rootDir, "dist-site");
const outAppDir = path.join(outDir, "app");

console.log("==========================================================");
console.log("  Kura (蔵) — Apple Showcase Website & Web App Bundler    ");
console.log("==========================================================");

if (!fs.existsSync(distAppDir)) {
  console.error(`[Error] dist/ directory not found. Please run "npm run build" first.`);
  process.exit(1);
}

// 1. Clean & recreate dist-site and dist-site/app
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outAppDir, { recursive: true });

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy compiled Kura App from dist/ to dist-site/app/
console.log(`[1/4] Copying live Kura POS app to: dist-site/app/`);
copyDir(distAppDir, outAppDir);

// 3. Copy Showcase Website files to dist-site/
console.log(`[2/4] Copying Apple product showcase from website/ to dist-site/`);
copyDir(websiteDir, outDir);

// 4. Copy branding assets & documentation
console.log(`[3/4] Copying icons & legal policies...`);
const iconSrc = path.join(rootDir, "public", "kura-icon.svg");
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(outDir, "kura-icon.svg"));
  fs.copyFileSync(iconSrc, path.join(outAppDir, "kura-icon.svg"));
}

const privacySrc = path.join(rootDir, "docs", "PRIVACY_POLICY.md");
if (fs.existsSync(privacySrc)) {
  fs.copyFileSync(privacySrc, path.join(outDir, "PRIVACY_POLICY.md"));
}

// 5. Verify & Report Structure
const outFiles = fs.readdirSync(outDir);
const appFiles = fs.readdirSync(outAppDir);

console.log("[4/4] Showcase build assembled successfully!");
console.log(`  - Root Showcase : dist-site/index.html (${outFiles.length} items)`);
console.log(`  - Live Web POS  : dist-site/app/index.html (${appFiles.length} items)`);
console.log("==========================================================");
