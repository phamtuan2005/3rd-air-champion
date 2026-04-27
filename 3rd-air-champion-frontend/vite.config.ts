import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
