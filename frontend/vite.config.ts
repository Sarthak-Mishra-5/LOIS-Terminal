import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs separately (backend/run.py, port 8600); Vite proxies /api to it.
// In production the backend serves the built files from dist/, so no proxy is involved.
export default defineConfig({
  plugins: [react()],
  // Only cartesian traces (heatmap, bar, scatter) are used, so alias the full Plotly bundle to the
  // much smaller cartesian build. Types still come from @types/plotly.js-dist-min.
  resolve: { alias: { 'plotly.js-dist-min': 'plotly.js-cartesian-dist-min' } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8600' },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: { manualChunks: { plotly: ['plotly.js-cartesian-dist-min'], lwc: ['lightweight-charts'] } },
    },
  },
});
