import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bible-miniapp",
  brand: {
    displayName: "오늘의 말씀",
    primaryColor: "#0D9488",
    icon: "./public/icons/logo-1024.png",
  },
  web: {
    host: "0.0.0.0",
    port: 5173,
    commands: {
      dev: "vite dev --host 0.0.0.0",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
