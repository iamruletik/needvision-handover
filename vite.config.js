import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true, // fail instead of hopping ports — the URL in Webflow is fixed
    cors: true, // the Webflow page lives on a foreign origin — without this the browser blocks requests
    origin: "http://localhost:5173", // absolute URLs for imported assets
  },
  build: {
    lib: {
      entry: "src/main.js",
      formats: ["iife"],
      name: "needvision",
      fileName: () => "main.js",
    },
  },
});
