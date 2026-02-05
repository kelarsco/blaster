import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env.VITE_API_PORT || 4000;
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
