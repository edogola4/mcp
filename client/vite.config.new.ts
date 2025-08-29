import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
