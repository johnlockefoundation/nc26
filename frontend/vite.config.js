import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import react from '@vitejs/plugin-react';

// `npm run build:pages` produces the GitHub Pages demo: data baked in as JSON,
// base set to the repo path.
//
// `npm run build:plugin` produces the bundle that ships inside the WordPress
// plugin. base is empty there because the plugin enqueues the JS and CSS itself
// with plugins_url(), and the build is a single chunk with no relative asset
// references, so nothing inside it needs to know where it lives.
//
// The target is derived from the build mode here rather than passed in as
// another env var, because mode and target are the same fact stated twice. A
// build that said mode=plugin and VITE_TARGET=pages would silently ship a
// Pages bundle to WordPress, and the symptom would be a plugin that fetches
// demo-data from its own directory and renders an empty map. deriveConfig has
// no way to express that disagreement, so the mistake cannot be made.
const TARGETS = { plugin: 'plugin', pages: 'pages' };

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_TARGET': JSON.stringify(TARGETS[mode] || 'dev'),
  },
  build: {
    // Fixed filenames so the plugin's enqueue calls are stable across rebuilds.
    ...(mode === 'plugin'
      ? {
          rollupOptions: {
            output: {
              entryFileNames: 'jce-app.js',
              chunkFileNames: 'jce-[name].js',
              assetFileNames: 'jce-[name].[ext]',
            },
          },
          cssCodeSplit: false,
        }
      // Two entries on Pages: the map, and the General Assembly hemicycle. The
      // seats page is a separate document rather than a route inside the map,
      // because it has its own URL worth linking to and it competes with the map
      // for the same screen. Named explicitly so the emitted filenames do not
      // drift with the order of the glob.
      : {
          rollupOptions: {
            input: {
              main: resolve(__dirname, 'index.html'),
              seats: resolve(__dirname, 'seats.html'),
            },
            output: {
              entryFileNames: 'assets/[name]-[hash].js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash].[ext]',
            },
          },
        }),
  },
  server: {
    port: 5173,
    proxy: mode === 'pages' ? undefined : { '/api': 'http://localhost:4000' },
  },
}));