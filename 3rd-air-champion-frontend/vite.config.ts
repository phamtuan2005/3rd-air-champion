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
        globPatterns: ["**/*.{js,css,html,png,jpg,svg}"],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://13.59.73.109:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        headers: { origin: "http://localhost:5173" },
      },
    },
  },
});