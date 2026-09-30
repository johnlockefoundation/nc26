import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run build:pages` produces a fully static demo (data baked in as JSON)
// for GitHub Pages. VITE_BASE is set by the deploy script to the repo path.
//
// `npm run build:plugin` produces the bundle that ships inside the WordPress
// plugin. base is empty there because the plugin enqueues the JS and CSS itself
// with plugins_url(), and the build is a single chunk with no relative asset
// references, so nothing inside it needs to know where it lives. Runtime
// configuration (the Supabase URL and anon key) reaches the app through a
// window.jceConfig global printed by PHP, not baked in.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
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
      : {}),
  },
  server: {
    port: 5173,
    proxy: mode === 'pages' ? undefined : { '/api': 'http://localhost:4000' },
  },
}));