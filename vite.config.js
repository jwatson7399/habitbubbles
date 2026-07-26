import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base './' keeps asset paths relative so the app works at
// https://<user>.github.io/<repo>/ without extra configuration
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "HabitBubbles",
        short_name: "Habits",
        description: "A personal habit ecosystem where bubbles swell as opportunities come due.",
        id: "/habitbubbles/",
        theme_color: "#12233A",
        background_color: "#12233A",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        cacheId: "habitbubbles",
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        navigateFallback: "index.html"
      }
    })
  ]
});
