import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_FILE = path.resolve(__dirname, '../server/.dev-server-port');
const PORT_CANDIDATES = [4000, 4001, 4002, 4003, 4004];
const PROBE_CACHE_MS = 3000;
const BACKEND_WARN_INTERVAL_MS = 15000;

let cachedApiPort = null;
let lastProbeAt = 0;
let lastBackendWarnAt = 0;

function readPortFile() {
  try {
    if (fs.existsSync(PORT_FILE)) {
      const port = parseInt(fs.readFileSync(PORT_FILE, 'utf8').trim(), 10);
      if (port > 0) return port;
    }
  } catch (_) {}
  return null;
}

function probePort(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 800,
      },
      (res) => {
        res.resume();
        // Any HTTP response means the API server is listening (503 = DB issue, still reachable).
        resolve(res.statusCode > 0);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolveApiPort({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedApiPort && now - lastProbeAt < PROBE_CACHE_MS) {
    return cachedApiPort;
  }
  lastProbeAt = now;

  const filePort = readPortFile();
  const envPort = Number(process.env.VITE_API_PORT);
  // Probe live candidates first — stale .dev-server-port must not win over a running server.
  const order = [...new Set([envPort, ...PORT_CANDIDATES, filePort].filter((p) => p > 0))];

  for (const port of order) {
    if (await probePort(port)) {
      cachedApiPort = port;
      if (filePort !== port) {
        try {
          fs.writeFileSync(PORT_FILE, String(port));
        } catch (_) {}
      }
      return port;
    }
  }

  cachedApiPort = null;
  return PORT_CANDIDATES[0];
}

function apiTarget() {
  const port = cachedApiPort || Number(process.env.VITE_API_PORT) || PORT_CANDIDATES[0];
  return `http://127.0.0.1:${port}`;
}

function startApiPortWatcher() {
  resolveApiPort({ force: true }).catch(() => {});
  const timer = setInterval(() => {
    resolveApiPort({ force: true }).catch(() => {});
  }, PROBE_CACHE_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

function warnBackendDown(port) {
  const now = Date.now();
  if (now - lastBackendWarnAt < BACKEND_WARN_INTERVAL_MS) return;
  lastBackendWarnAt = now;
  console.warn(
    `[vite proxy] Backend not reachable (tried ports ${PORT_CANDIDATES.join(', ')}).\n` +
      '  Start both server and client from project root:\n' +
      '    npm run dev\n' +
      '  Or in two terminals:\n' +
      '    cd server && npm run dev\n' +
      '    cd client && npm run dev'
  );
}

startApiPortWatcher();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'await-api-port',
      async configureServer() {
        const port = await resolveApiPort({ force: true });
        console.log(`[vite] API proxy → http://127.0.0.1:${port}`);
      },
    },
  ],
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
            const msg = err?.message || String(err);
            const cause = err?.cause?.message || err?.errors?.[0]?.message || '';
            const isBackendDown = /ECONNREFUSED|ECONNRESET/.test(msg) || /ECONNREFUSED|ECONNRESET/.test(cause);
            if (isBackendDown) {
              resolveApiPort({ force: true }).then((port) => {
                warnBackendDown(port);
              });
            } else {
              console.error('[vite proxy]', msg);
            }
          });
        },
      },
    },
  },
});
