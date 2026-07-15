// Inlines the built JS + CSS into one offline-playable HTML file.
// Runs automatically after `vite build`; output: dist/lemonade-days.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

// Vite prefixes asset URLs with the configured site base. On GitHub Pages that
// looks like `/lemonade-days/assets/file.js`, while the file on disk is still
// `dist/assets/file.js`. Keep only the built `assets/` portion.
function builtAssetPath(reference) {
  const pathname = decodeURIComponent(new URL(reference, 'https://build.invalid/').pathname);
  const assetMarker = '/assets/';
  const markerIndex = pathname.lastIndexOf(assetMarker);

  if (markerIndex === -1) {
    throw new Error(`Expected a Vite asset URL, received: ${reference}`);
  }

  return path.join(dist, pathname.slice(markerIndex + 1));
}

html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, src) => {
  const js = fs.readFileSync(builtAssetPath(src), 'utf8');
  return `<script type="module">\n${js}\n</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => {
  const css = fs.readFileSync(builtAssetPath(href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

fs.writeFileSync(path.join(dist, 'lemonade-days.html'), html);
console.log('single-file build: dist/lemonade-days.html', `(${(html.length / 1024).toFixed(0)} kB)`);
