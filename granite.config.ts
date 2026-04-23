import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "bible-mini",
  brand: {
    displayName: "오늘의 말씀",
    primaryColor: "#0D9488",
    icon: "https://static.toss.im/appsintoss/36039/369de236-5bbb-4149-a83a-8aadfef3330d.png",
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
