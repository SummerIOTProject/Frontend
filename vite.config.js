import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendOrigin = env.VITE_BACKEND_ORIGIN?.trim().replace(/\/$/, "");

  return {
    plugins: [tailwindcss()],
    appType: "mpa",
    server: {
      port: 5173,
      proxy: backendOrigin ? {
        "/backend": {
          target: backendOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/backend/, ""),
        },
      } : {},
    },
    preview: { port: 5173 },
    build: {
      emptyOutDir: true,
      rolldownOptions: {
        input: {
          login: resolve(import.meta.dirname, "index.html"),
          dashboard: resolve(import.meta.dirname, "dashboard.html"),
          menu: resolve(import.meta.dirname, "menu.html"),
          upload: resolve(import.meta.dirname, "upload.html"),
          history: resolve(import.meta.dirname, "history.html"),
          meal: resolve(import.meta.dirname, "meal.html"),
          admin: resolve(import.meta.dirname, "admin.html"),
        },
      },
    },
  };
});
