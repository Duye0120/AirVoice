import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: './',
  server: {
    port: 8081,
    proxy: {
      '/api': {
        target: 'http://localhost:23456',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:23456',
        ws: true
      }
    }
  },
  build: {
    outDir: '../dist/mobile',
    emptyOutDir: true
  },
  css: {
    postcss: resolve(__dirname, '..')
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared')
    }
  }
});
