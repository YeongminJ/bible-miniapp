import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bible-miniapp",
  brand: {
    displayName: "오늘의 은혜",
    primaryColor: "#0D9488",
    icon: "",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
