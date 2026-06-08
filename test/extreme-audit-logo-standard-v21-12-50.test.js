import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const svg = fs.readFileSync('public/assets/valorae-logo.svg', 'utf8');
const manifest = fs.readFileSync('public/manifest.webmanifest', 'utf8');
const sw = fs.readFileSync('public/service-worker.js', 'utf8');

assert.equal(html, index, 'index.html deve espelhar server.html');
assert.match(html, /21\.12\.(54-total-apk-proxy-contract|56-full-audit-benchmark-apk-compat|57-user-points-apk-compat|58-revenue-breakdowns-app-contract|59-valorae-i10-rankings-complete|60-valorae-i10-home-rankings-sync|61-valorae-i10-complete-asset-charts|62-valorae-i10-complete-asset-charts|65-valorae-i10-dividend-agenda-parser-boundary-fix|66-valorae-i10-dividend-agenda-end-to-end-fix)/, 'release atual deve estar exposta');
assert.match(html, /<div class="logo logo--header"[^>]*><img src="\/assets\/valorae-logo\.svg"/, 'logo do cabeçalho deve usar ativo SVG padronizado');
assert.match(html, /<div class="logo logo--drawer"[^>]*><img src="\/assets\/valorae-logo\.svg"/, 'logo do drawer deve usar o mesmo ativo SVG');
assert.doesNotMatch(html, /<div class="logo"[^>]*>V<\/div>/, 'logo antigo com letra V não deve voltar');
assert.match(html, /\.logo\{[^}]*width:42px!important[^}]*height:42px!important/s, 'logo interno deve ter tamanho desktop padronizado');
assert.match(html, /@media\(max-width:520px\)[^{]*\{[^}]*\.logo\{[^}]*width:34px!important/s, 'logo interno deve reduzir corretamente em mobile');
assert.match(html, /id="themeToggleBtn"/, 'botão de tema deve permanecer no cabeçalho');
assert.match(html, /id="page-settings"/, 'página de configurações deve permanecer no app');
assert.match(html, /\.cs-menu\{[^}]*position:fixed/s, 'dropdowns de filtro devem continuar flutuando no viewport');
assert.match(html, /window\._positionOpenCustomSelect/, 'reposicionamento automático de filtros deve continuar ativo');
assert.match(svg, /<linearGradient id="mark"/, 'logo SVG deve ter marca vetorial redesenhada');
assert.match(svg, /M110 132h94l56 151/, 'logo SVG deve conter V geométrico do VALORAE');
assert.ok(fs.statSync('public/assets/valorae-icon-192.png').size > 1000, 'ícone PWA 192 precisa existir e não estar vazio');
assert.ok(fs.statSync('public/assets/valorae-icon-512.png').size > 3000, 'ícone PWA 512 precisa existir e não estar vazio');
assert.match(manifest, /21\.12\.(54|56|57|58|59|60|61|62|63|64|65|66)/, 'manifest PWA deve expor a release atual');
assert.match(sw, /valorae-proxy-server-v21-12-(54|56|57|58|59|60|61|62|63|64|65|66)/, 'service worker deve usar cache novo da release atual');

const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
fs.writeFileSync('/tmp/valorae-extreme-audit-logo-standard-v21-12-54.js', script);
execFileSync(process.execPath, ['--check', '/tmp/valorae-extreme-audit-logo-standard-v21-12-54.js'], { stdio: 'inherit' });

console.log('extreme-audit-logo-standard-v21-12-54 OK');
