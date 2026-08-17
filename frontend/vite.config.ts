import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'recharts': path.resolve(__dirname, './src/recharts-stub.tsx'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5401,
  },
  build: {
    emptyOutDir: false,
  },
});
