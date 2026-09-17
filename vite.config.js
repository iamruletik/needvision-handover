import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

// GitHub Pages URL this bundle deploys to — no custom domain.
// Baked into the code as __SITE_BASE__ (see src/modules/SceneLoader.js) so asset
// URLs resolve against OUR origin even though the script runs on Webflow's page.
export const PRODUCTION_SITE_BASE = "https://iamruletik.github.io/needvision-handover/";

// Runtime assets (gltf/, textures/, videos/ — ~25MB) are served from Google Cloud
// Storage, not Pages: Pages has a soft 100GB/month bandwidth limit and no cache
// control. Keeps the deployed dist/ small — only the JS bundles ship to Pages.
// The bucket has no /static folder; staticUrl() strips that prefix.
export const PRODUCTION_STATIC_BASE = "https://storage.googleapis.com/radiance/needvision";

export default defineConfig(({ command }) => ({
  base: command === "build" ? PRODUCTION_SITE_BASE : "/",
  server: {
    port: 5173,
    strictPort: true, // fail instead of hopping ports — the URL in Webflow is fixed
    cors: true, // the Webflow page lives on a foreign origin — without this the browser blocks requests
    origin: "http://localhost:5173", // absolute URLs for imported assets
  },
  define: {
    // Explicit constant instead of import.meta.url: the prod build is an IIFE,
    // where import.meta doesn't exist at all — this works identically in both.
    __SITE_BASE__: JSON.stringify(command === "build" ? PRODUCTION_SITE_BASE : "http://localhost:5173/"),
  },
  plugins: [
    cssInjectedByJsPlugin(), // one script tag in prod — CSS gets inlined into main.js instead of a separate file
  ],
  build: {
    lib: {
      entry: "src/main.js",
      formats: ["iife"],
      name: "needvision",
      fileName: () => "main.js",
    },
  },
}));
