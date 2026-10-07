import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Standalone Retrograde page: `npm run build:retro` writes
 * dist-retro/retrograde.html, one self-contained file (JS and CSS inline)
 * built from the same RetrogradeView as the app's Retrograde tab. It is
 * published as the claude.ai artifact named in DEVELOPMENT.md, so any
 * change to the view should be rebuilt and republished there.
 *
 * The output is an HTML fragment (title, style, markup, script) because
 * the artifact host supplies the <html>/<head>/<body> skeleton. A full
 * document of the same page goes to dist/retrograde/index.html, so the
 * app deploy serves it publicly at <app>/retrograde/ (`npm run build`
 * runs this config after the app build).
 */
function inlineSingleFile(): Plugin {
  return {
    name: 'inline-single-file',
    apply: 'build',
    closeBundle() {
      const dir = resolve(__dirname, 'dist-retro');
      const html = readFileSync(resolve(dir, 'retro.html'), 'utf8');
      const js = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"/)![1]!;
      const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/)![1]!;
      const code = readFileSync(resolve(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script');
      const style = readFileSync(resolve(dir, css), 'utf8');
      const fragment = '<title>Inner Planet Retrogrades</title>\n'
        + `<style>${style}</style>\n`
        + '<div id="app"></div>\n'
        + `<script type="module">${code}</script>\n`;
      writeFileSync(resolve(dir, 'retrograde.html'), fragment);
      // the same page, as a full document, served with the app at retrograde/
      const app = resolve(__dirname, 'dist', 'retrograde');
      mkdirSync(app, { recursive: true });
      writeFileSync(resolve(app, 'index.html'),
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + '<meta name="theme-color" content="#0e1220">\n</head>\n<body>\n'
        + fragment + '</body>\n</html>\n');
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [svelte(), inlineSingleFile()],
  build: {
    outDir: 'dist-retro',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: resolve(__dirname, 'retro.html') },
  },
});
