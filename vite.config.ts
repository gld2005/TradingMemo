import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    exclude: ['electron/**/*.test.cjs', '**/node_modules/**', '**/dist/**'],
    setupFiles: './src/test/setup.ts',
  },
});
