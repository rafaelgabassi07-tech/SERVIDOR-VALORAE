import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');

assert.equal(index, server, 'index.html e server.html devem permanecer idênticos');

const views = [...index.matchAll(/<section class="view(?: active)?" id="view-([^"]+)"/g)].map(match => ({ name: match[1], start: match.index }));
for (let i = 0; i < views.length; i += 1) {
  views[i].end = i + 1 < views.length ? views[i + 1].start : index.length;
}

const expected = ['traffic', 'request', 'routes', 'sources', 'health', 'diagnostics', 'architecture', 'benchmark', 'settings'];
for (const name of expected) {
  const view = views.find(item => item.name === name);
  assert.ok(view, `subpágina ausente: ${name}`);
  const html = index.slice(view.start, view.end);
  assert.match(html, /class="back-link"/, `subpágina sem botão voltar: ${name}`);
  assert.match(html, /<svg[^>]*viewBox="0 0 24 24"/, `botão voltar sem ícone: ${name}`);
  if (name === 'request') {
    assert.match(html, /href="\/monitor\/traffic"[^>]*data-nav="traffic"/, 'detalhe deve voltar ao tráfego');
  } else {
    assert.match(html, /href="\/monitor"[^>]*data-nav="overview"/, `${name} deve voltar à visão geral`);
  }
}

const overview = views.find(item => item.name === 'overview');
assert.ok(overview);
assert.doesNotMatch(index.slice(overview.start, overview.end), /class="back-link"/, 'visão geral não deve exibir retorno redundante');
assert.match(css, /\.back-link\{[^}]*min-height:44px/s, 'alvo de toque do botão voltar deve ter pelo menos 44 px');
assert.match(runtime, /tests: 'diagnostics'/);
assert.match(runtime, /'\/inspector\.html': 'diagnostics'/);
assert.match(worker, /ui-v367-backnav1/);

console.log('monitor subpage back navigation v367 OK');
