import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

assert.equal(html, index, 'index.html deve espelhar server.html');
assert.match(html, /21\.12\.48-monitor-responsive-settings-theme/, 'release v21.12.49 deve estar exposta');

for (const token of [
  'id="page-settings"',
  'data-page="settings"',
  'id="themeToggleBtn"',
  'data-theme-choice="dark"',
  'data-theme-choice="light"',
  'data-theme-choice="system"',
  'id="settingsApiBaseInput"',
  'id="settingsResponsiveBox"',
  'filterToolbar',
  'class="icoSvg"',
  'body.theme-light',
  'position:fixed',
  'window._positionOpenCustomSelect',
]) {
  assert.ok(html.includes(token), `Monitor v21.12.49 deve conter ${token}`);
}

assert.match(html, /\.cs-opt\{[^}]*white-space:normal/s, 'opções dos filtros devem quebrar linha em vez de cortar texto');
assert.match(html, /\.cs-menu\{[^}]*position:fixed/s, 'menu dos filtros deve flutuar no viewport');
assert.match(html, /@media\(max-width:680px\)/, 'deve haver breakpoint específico de mobile');
assert.match(script, /function applyTheme\(/, 'script deve aplicar tema claro/escuro');
assert.match(script, /function renderSettings\(/, 'script deve renderizar página de configurações');
assert.match(script, /function initSettings\(/, 'script deve inicializar configurações');
assert.match(script, /function positionMenu\(wrap\)/, 'script deve reposicionar dropdown para não cortar opções');
assert.doesNotMatch(html, /<span class="ico">[⌁⇄▧✓↗⚡]/, 'ícones antigos do menu lateral não devem voltar');

fs.writeFileSync('/tmp/valorae-monitor-responsive-settings-theme-v21-12-48.js', script);
execFileSync(process.execPath, ['--check', '/tmp/valorae-monitor-responsive-settings-theme-v21-12-48.js'], { stdio: 'inherit' });

console.log('monitor-responsive-settings-theme-v21-12-48 OK');
