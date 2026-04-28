import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'AgriVision',
        short_name: 'AgriVision',
        description: 'AI-powered agriculture assistant for farmers',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        icons: []
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  optimizeDeps: {
    include: ['lucide-react', 'framer-motion', 'firebase/app', 'firebase/auth', '@google/generative-ai']
  }
});
