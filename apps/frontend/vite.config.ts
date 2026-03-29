import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@eduplatform/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 500,
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://backend:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
