import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "remove-duplicate-manifest",
      transformIndexHtml: {
        order: "post" as const,
        handler(html: string) {
          const matches = [...html.matchAll(/<link rel="manifest"[^>]*>/g)];
          if (matches.length > 1) {
            const last = matches[matches.length - 1];
            html = html.slice(0, last.index) + html.slice(last.index! + last[0].length);
          }
          return html;
        },
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["timag-icon-192.png", "timag-icon-512.png", "tibook-icon-192.png", "tibook-icon-512.png", "Anh-Tuan.jpg", "Cindy.jpg"],
      manifest: {
        name: "TiMag – TT House",
        short_name: "TiMag",
        description: "Manage your TT House property",
        // id "/" is what TiMag's identity already was (it defaults to
        // start_url), so a TiMag already installed stays the same app. TiBook
        // and TiWork declare their own id and scope (/book, /work) in their
        // manifests: without one, a manifest's scope defaults to "/", every
        // app claimed the whole site, and with TiMag installed a phone opened
        // /book as TiMag and never offered to install TiBook (Samsung Internet,
        // host, 2026-10-11).
        id: "/",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4f46e5",
        icons: [
          { src: "timag-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "timag-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // The one JS bundle passed workbox's 2 MiB default (2026-10-06, the TT
        // reviews commit took it to 2.10 MB) and the build FAILED, so nothing
        // could be deployed. Skipping the file instead would be worse than
        // failing: the main bundle would not be precached, and a phone with a
        // cached shell would fetch it fresh on every load. 4 MiB leaves room;
        // the real fix when it nears that is to code-split the app.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,png,jpg,svg}"],
        // Throw away precaches from earlier builds when a new worker activates.
        // Without this a browser kept serving a shell whose asset hashes no
        // longer existed — and CloudFront answers a missing path with
        // index.html and a 200, so the page tried to run HTML as JavaScript and
        // came up blank. It stranded Samsung Internet while Chrome, which had
        // already taken a fresh shell, was fine.
        cleanupOutdatedCaches: true,
        // Take over on the first load rather than waiting for every tab to
        // close. A guest with TiBook open on their phone never closes the tab,
        // so "waiting" meant waiting forever.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      "/api": {
        // The server's Elastic IP. It was 13.59.73.109 — an auto-assigned
        // address, not a reserved one — until the box was stopped on
        // 2026-10-16 and came back on another; 3.131.53.9 stays through any
        // stop and start.
        target: "http://3.131.53.9:8080",
        changeOrigin: true,
        headers: { origin: "http://localhost:5173" },
      },
    },
  },
});