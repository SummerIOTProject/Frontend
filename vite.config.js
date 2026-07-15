import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tailwindcss()],
  appType: "mpa",
  server: {
    port: 3000,
    proxy: {
      "/backend": {
        target: "https://backend-five-kohl-41.vercel.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ""),
      },
    },
  },
  preview: { port: 3000 },
  build: {
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        login: resolve(import.meta.dirname, "index.html"),
        dashboard: resolve(import.meta.dirname, "dashboard.html"),
        upload: resolve(import.meta.dirname, "upload.html"),
        history: resolve(import.meta.dirname, "history.html"),
        meal: resolve(import.meta.dirname, "meal.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
      },
    },
  },
  test: { environment: "jsdom" },
});
