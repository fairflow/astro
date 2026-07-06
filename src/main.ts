import { mount } from 'svelte';
import App from './ui/App.svelte';
import GlyphSheet from './ui/GlyphSheet.svelte';
import './ui/app.css';

const root = location.search.includes('glyphs') ? GlyphSheet : App;
mount(root, { target: document.getElementById('app')! });

// Offline/installability: register the service worker in production
// builds only (it would fight Vite's dev-server HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* not fatal: the app still works online */
    });
  });
}
