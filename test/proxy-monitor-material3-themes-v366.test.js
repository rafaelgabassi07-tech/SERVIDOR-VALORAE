import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const worker = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');

assert.equal(html, server, 'index e fallback precisam permanecer idênticos');
assert.doesNotThrow(() => new vm.Script(runtime));
assert.match(html, /valorae-monitor-material3-polish-v367/);
assert.match(html, /<span class="eyebrow">Material 3<\/span>/);

for (const mode of ['system', 'light', 'dark']) {
  assert.match(html, new RegExp(`data-theme-mode="${mode}"`));
}
const palettes = {
  gold: 'Ouro Classic', champagne: 'Coral Solar', amber: 'Turquesa Oceano', graphite: 'Grafite Mineral',
  sapphire: 'Azul Safira', emerald: 'Esmeralda Verde', amethyst: 'Lírio Ametista', ruby: 'Vermelho Rubi', platinum: 'Cacau Bronze',
};
for (const [id, label] of Object.entries(palettes)) {
  assert.match(html, new RegExp(`data-color-theme="${id}"`));
  assert.ok(html.includes(label), `rótulo ausente: ${label}`);
  assert.match(css, new RegExp(`data-color-theme="${id}"`));
}
for (const token of ['--md-primary', '--md-primary-container', '--md-surface-container-low', '--md-on-surface-variant', '--radius-full']) {
  assert.ok(css.includes(token), `token Material 3 ausente: ${token}`);
}
for (const component of ['theme-palette-grid', 'material-theme-preview', 'preview-filled', 'preview-tonal', 'theme-palette-button']) {
  assert.match(css, new RegExp(`\\.${component}`));
}
assert.match(html, /data-density="comfortable"/);
assert.match(html, /data-density="compact"/);
assert.match(html, /data-motion="standard"/);
assert.match(html, /data-motion="reduced"/);
assert.match(runtime, /const COLOR_THEMES = Object\.freeze/);
assert.match(runtime, /function applyAppearance/);
assert.match(runtime, /storage\.set\(STORAGE\.colorTheme,palette\)/);
assert.match(runtime, /document\.body\.dataset\.colorTheme=palette/);
assert.match(runtime, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
assert.match(runtime, /MONITOR_VERSION = 'v367'/);
assert.equal(manifest.monitor_version, 'v367');
assert.match(worker, /ui-v367/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /backdrop-filter\s*:/i);
console.log('proxy-monitor-material3-themes-v366 ok');
