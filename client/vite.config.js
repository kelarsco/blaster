import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readDevServerPort() {
  try {
    const portFile = path.resolve(__dirname, '../server/.dev-server-port');
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
      if (port > 0) return port;
    }
  } catch (_) {}
  return Number(process.env.VITE_API_PORT) || 4000;
}

function apiTarget() {
  return `http://localhost:${readDevServerPort()}`;
}

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget(),
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        // Re-read server/.dev-server-port on each request (server may start after Vite)
        router: () => apiTarget(),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.host) {
              proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
            }
            const isLocal = String(req.headers.host || '').includes('localhost');
            proxyReq.setHeader(
              'X-Forwarded-Proto',
              req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https')
            );
          });
          proxy.on('error', (err) => {
            const port = readDevServerPort();
            const msg = err?.message || String(err);
            const cause = err?.cause?.message || err?.errors?.[0]?.message || '';
            const isBackendDown = /ECONNREFUSED|ECONNRESET/.test(msg) || /ECONNREFUSED|ECONNRESET/.test(cause);
            if (isBackendDown) {
              console.warn(
                `[vite proxy] Backend not reachable at http://localhost:${port}.\n` +
                  '  Start both server and client from project root:\n' +
                  '    npm run dev\n' +
                  '  Or in two terminals:\n' +
                  '    cd server && npm run dev\n' +
                  '    cd client && npm run dev'
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
