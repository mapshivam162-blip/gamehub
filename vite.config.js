import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // phone + LAN devices se access ke liye
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
