import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import packageJson from "./package.json";

function readGitCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_MITRU_APP_VERSION": JSON.stringify(packageJson.version),
    "import.meta.env.VITE_MITRU_BUILD_COMMIT": JSON.stringify(readGitCommitHash()),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: process.env.TAURI_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_DEBUG),
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) return "vendor-react";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@tanstack/react-table")) return "vendor-table";
          if (id.includes("@pdf-lib/fontkit")) return "vendor-pdf-fontkit";
          if (id.includes("pdf-lib") || id.includes("@pdf-lib")) return "vendor-pdf-core";
          if (id.includes("tesseract.js") || id.includes("@tesseract.js-data")) return "vendor-ocr";
          if (id.includes("@tauri-apps")) return "vendor-tauri";
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor";
        },
      },
    },
  },
});
