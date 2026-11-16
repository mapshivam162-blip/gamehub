import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa', // alag-alag static game pages, koi SPA fallback nahi
  base: './', // GitHub Pages ke liye relative paths
  server: {
    host: true, // phone + LAN devices se access ke liye
    port: 5173,
  },
  build: {
    outDir: 'dist',
    target: 'es2022', // top-level await (firebase init) ke liye
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        profile: new URL('./profile.html', import.meta.url).pathname,
        settings: new URL('./settings.html', import.meta.url).pathname,
        publish: new URL('./publish.html', import.meta.url).pathname,
        play: new URL('./play.html', import.meta.url).pathname,
      },
    },
  },
});
