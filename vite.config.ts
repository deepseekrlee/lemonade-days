import { defineConfig } from 'vite';

// VITE_BASE is set by the GitHub Pages workflow; defaults to "/" locally.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: {
    assetsInlineLimit: 1e9, // inline everything -> single JS chunk, ready for the single-file export
    modulePreload: { polyfill: false },
  },
});
