import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env.VITE_API_PORT || 4000;
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            const msg = err?.message || String(err);
            const cause = err?.cause?.message || err?.errors?.[0]?.message || '';
            const isBackendDown = /ECONNREFUSED|ECONNRESET/.test(msg) || /ECONNREFUSED|ECONNRESET/.test(cause);
            if (isBackendDown) {
              console.warn(
                '[vite proxy] Backend not reachable at http://localhost:' + apiPort + '. Start to API server:\n  cd server && npm run dev\n  Or from project root: npm run dev'
              );
            } else {
              console.error('[vite proxy]', msg);
            }
          });
        },
      },
    },
  },
});
