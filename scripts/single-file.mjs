// Inlines the built JS + CSS into one offline-playable HTML file.
// Runs automatically after `vite build`; output: dist/lemonade-days.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, src) => {
  const js = fs.readFileSync(path.join(dist, src.replace(/^\//, '').replace(/^\.\//, '')), 'utf8');
  return `<script type="module">\n${js}\n</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => {
  const css = fs.readFileSync(path.join(dist, href.replace(/^\//, '').replace(/^\.\//, '')), 'utf8');
  return `<style>\n${css}\n</style>`;
});

fs.writeFileSync(path.join(dist, 'lemonade-days.html'), html);
console.log('single-file build: dist/lemonade-days.html', `(${(html.length / 1024).toFixed(0)} kB)`);
