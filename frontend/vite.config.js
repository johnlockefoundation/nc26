import { defineConfig } from 'vite';
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
      // One entry on Pages. The fixed asset filenames are only pinned for the
      // plugin, whose enqueue calls must stay stable; Pages takes Vite's hashed
      // defaults so its own filenames can change freely.
      : {}),
  },
  server: {
    port: 5173,
    proxy: mode === 'pages' ? undefined : { '/api': 'http://localhost:4000' },
  },
}));