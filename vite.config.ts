import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  base: "./",
  plugins: [preact(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // SupportingSofts holds the Android SDK and Unity Hub (tens of thousands of files);
      // watching it stalls the dev server. The others are build outputs.
      ignored: ["**/src-tauri/**", "**/SupportingSofts/**", "**/dist/**", "**/dist-site/**", "**/.wrangler/**"],
    },
  },
  // Without this, Vite's dependency scan globs every *.html in the project,
  // including the multi-GB src-tauri/target, and the dev server stalls.
  optimizeDeps: {
    entries: ["index.html"],
  },
  esbuild: {
    legalComments: "none",
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    cssMinify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
