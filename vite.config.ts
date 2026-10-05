 import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Lovable-hosted binary assets (src/assets/*.asset.json) are not in the repo;
    // serve them from the production domain during local dev.
    proxy: {
      "/__l5e": {
        target: "https://ellosuit.app",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/__l5e": {
        target: "https://ellosuit.app",
        changeOrigin: true,
      },
    },
  },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./src"),
     },
   },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
    },
 }));
