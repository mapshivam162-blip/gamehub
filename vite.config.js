import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa', // alag-alag static game pages, koi SPA fallback nahi
  server: {
    host: true, // phone + LAN devices se access ke liye
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
