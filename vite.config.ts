import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Erzeugt beim Build dist/sw.js mit der Liste aller Dateien. So ist nach dem ersten Aufruf
 * (mit Internet) alles im Browser und die App läuft in der Halle auch ohne Netz.
 */
function serviceWorker(): Plugin {
  return {
    name: 'turnier-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter(f => {
        if (f.endsWith('.map')) return false;
        // Schriften: nur woff2 und nur lateinische Zeichensätze vorhalten
        if (/\.(woff2?|ttf)$/.test(f)) return f.endsWith('.woff2') && /-latin-(ext-)?/.test(f);
        return true;
      });
      const precache = ['./', ...files.filter(f => f !== 'index.html').map(f => `./${f}`), './icon.svg', './manifest.webmanifest'];
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const source = `// Automatisch erzeugt (vite.config.ts) – nicht von Hand ändern.
const CACHE = 'turnier-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('turnier-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;

  if (req.mode === 'navigate') {
    // Seite: erst Netz (damit Updates ankommen), nach 3 s oder offline aus dem Speicher
    event.respondWith(
      Promise.race([fetch(req), timeout(3000)])
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
          return res;
        })
        .catch(() => caches.match('./', { cacheName: CACHE }).then(r => r || Response.error())),
    );
    return;
  }

  // Dateien mit Prüfsumme im Namen ändern sich nie: Speicher zuerst
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Die App läuft unter https://buchstabenklau.ddns.net/turnier/
export default defineConfig({
  base: '/turnier/',
  plugins: [svelte(), serviceWorker()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] },
});
