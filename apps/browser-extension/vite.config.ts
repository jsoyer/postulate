import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"
import { copyFileSync, mkdirSync, existsSync, rmSync } from "fs"

// ---------------------------------------------------------------------------
// Custom plugin: copy manifest.json, icons, and HTML pages to dist root
// ---------------------------------------------------------------------------
function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    writeBundle() {
      const root = resolve(__dirname)

      // Manifest
      const manifestSrc = resolve(root, "src/manifest.json")
      const manifestDest = resolve(root, "dist/manifest.json")
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, manifestDest)
      } else {
        console.warn("[copy-extension-assets] manifest.json not found at", manifestSrc)
      }

      // Icons
      const iconsDir = resolve(root, "dist/icons")
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })

      const iconFiles = ["icon-16.png", "icon-48.png", "icon-128.png"]
      for (const icon of iconFiles) {
        const src = resolve(root, "public/icons", icon)
        const dest = resolve(iconsDir, icon)
        if (existsSync(src)) {
          copyFileSync(src, dest)
        }
      }

      // HTML pages: Vite outputs them under dist/src/* (relative to project root).
      // The manifest references popup/index.html and options/index.html, so we
      // copy them to the expected locations and remove the stale dist/src/ subtree.
      const htmlPages = [
        { from: "dist/src/popup/index.html", to: "dist/popup/index.html", dir: "dist/popup" },
        {
          from: "dist/src/options/index.html",
          to: "dist/options/index.html",
          dir: "dist/options",
        },
      ]
      for (const page of htmlPages) {
        const src = resolve(root, page.from)
        const dest = resolve(root, page.to)
        const dir = resolve(root, page.dir)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        if (existsSync(src)) {
          copyFileSync(src, dest)
        } else {
          console.warn(`[copy-extension-assets] HTML not found at ${src}`)
        }
      }

      // Remove the stale dist/src/ directory produced by Vite's HTML transform
      const distSrc = resolve(root, "dist/src")
      if (existsSync(distSrc)) {
        rmSync(distSrc, { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyExtensionAssets()],

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: true,

    rollupOptions: {
      input: {
        // Pages
        popup: resolve(__dirname, "src/popup/index.html"),
        options: resolve(__dirname, "src/options/index.html"),
        // Scripts (no HTML entry)
        "background/service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts"
        ),
        "content/index": resolve(__dirname, "src/content/index.ts"),
      },

      output: {
        // Keep script paths predictable so manifest.json references work
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background/service-worker")
            return "background/service-worker.js"
          if (chunkInfo.name === "content/index") return "content/index.js"
          return "[name].js"
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "styles/[name]-[hash].css"
          return "assets/[name]-[hash][extname]"
        },
      },
    },
  },

  // Silence chrome.* globals in type-checking (they come from @types/chrome)
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
})
