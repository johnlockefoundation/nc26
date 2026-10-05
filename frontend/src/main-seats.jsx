import React from 'react';
import { createRoot } from 'react-dom/client';
import SeatsPage from './SeatsPage.jsx';
import './styles.css';

// The mount point differs by host. GitHub Pages ships a #root div in
// index.html; the WordPress plugin renders its own container and marks it with
// data-jce-root, because the plugin has no #root to find and must not be given
// one -- the id is generic enough to collide with a theme.
const mount = document.querySelector('[data-jce-root]') || document.getElementById('root');

if (!mount) {
  throw new Error('Carolina Elections: no mount point found (expected [data-jce-root] or #root)');
}

createRoot(mount).render(
  <React.StrictMode>
    <SeatsPage />
  </React.StrictMode>
);
