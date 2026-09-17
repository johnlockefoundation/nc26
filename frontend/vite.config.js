import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run build:pages` produces a fully static demo (data baked in as JSON)
// for GitHub Pages. VITE_BASE is set by the deploy script to the repo path.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: mode === 'pages' ? undefined : { '/api': 'http://localhost:4000' },
  },
}));