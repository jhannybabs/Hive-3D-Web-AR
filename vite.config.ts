import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "iife",
  },
  server: {
    host: true,
    strictPort: true,
    allowedHosts: [
      "virilocally-bearish-val.ngrok-free.dev", // ✅ exact ngrok host
      ".ngrok-free.dev", // ✅ wildcard for any ngrok subdomain
    ],
    port: 5173,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
