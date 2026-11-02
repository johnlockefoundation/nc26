import React from 'react';
import { createRoot } from 'react-dom/client';
import ElectionPage from './ElectionPage.jsx';
import './styles.css';

const mount = document.querySelector('[data-jce-root]') || document.getElementById('root');

if (!mount) {
  throw new Error('Carolina Elections: no mount point found (expected [data-jce-root] or #root)');
}

createRoot(mount).render(
  <React.StrictMode>
    <ElectionPage />
  </React.StrictMode>
);