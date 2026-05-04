import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // exposes on LAN so your phone can reach it
    port: 4000,
    proxy: {
      "/api": { target: "http://localhost:8002", changeOrigin: true },
      "/uploads": { target: "http://localhost:8002", changeOrigin: true },
    },
  },
});
