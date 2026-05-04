import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, ChildProcess } from "child_process";
import path from "path";

function backendPlugin() {
  let backend: ChildProcess | null = null;
  return {
    name: "start-backend",
    configureServer() {
      const backendDir = path.resolve(__dirname, "../backend");
      backend = spawn("python", ["-m", "uvicorn", "main:app", "--reload", "--port", "8002"], {
        cwd: backendDir,
        stdio: "inherit",
        shell: true,
      });
      backend.on("error", (err) => console.error("[backend]", err.message));
      process.on("exit", () => backend?.kill());
    },
  };
}

export default defineConfig({
  plugins: [react(), backendPlugin()],
  server: {
    host: true,   // exposes on LAN so your phone can reach it
    port: 4000,
    proxy: {
      "/api": { target: "http://localhost:8002", changeOrigin: true },
      "/uploads": { target: "http://localhost:8002", changeOrigin: true },
    },
  },
});
