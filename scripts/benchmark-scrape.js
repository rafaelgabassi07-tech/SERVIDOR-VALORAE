import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { extractCustomSelectors } from '../lib/scrape/custom-selectors.js';
import { extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { normalizeScrapeInput, buildResultKey, buildFetchKey } from '../lib/scrape/scrape-input.js';

const html = `<html><head><title>VALORAE</title><meta name="description" content="Proxy"></head><body>${Array.from({ length: 350 }, (_, i) => `<a href="/a${i}">Link ${i}</a><span class="price">R$ ${i},00</span><div class="card"><strong>${i}</strong></div>`).join('')}</body></html>`;
const selectors = { title: 'title', h1: 'h1', price: '.price', href: { selector: 'a[href]', extract: 'href' } };

function run(name, fn, loops = 120) {
  const values = [];
  for (let i = 0; i < loops; i++) {
    const t = performance.now();
    fn();
    values.push(performance.now() - t);
  }
  values.sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const p95 = values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)];
  return { name, loops, avgMs: Math.round(avg * 1000) / 1000, medianMs: Math.round(values[Math.floor(values.length / 2)] * 1000) / 1000, p95Ms: Math.round(p95 * 1000) / 1000 };
}

const normalized = normalizeScrapeInput({ url: 'https://investidor10.com.br/acoes/petr4/', selectors, compact: true });
const report = {
  generatedAt: new Date().toISOString(),
  network: 'mocked/local-only',
  htmlBytes: Buffer.byteLength(html),
  cases: [
    run('fast-selectors-single-pass', () => extractFastSelectors(html, selectors)),
    run('custom-selectors-css-lite', () => extractCustomSelectors(html, selectors)),
    run('signature-result-key', () => buildResultKey(normalized), 500),
    run('signature-fetch-key', () => buildFetchKey(normalized), 500),
  ],
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/benchmark-scrape.json', JSON.stringify(report, null, 2));
fs.writeFileSync('reports/benchmark-scrape.md', `# Benchmark scraping VALORAE\n\nGerado em ${report.generatedAt}. Rede: ${report.network}.\n\n| Caso | loops | média ms | mediana ms | p95 ms |\n|---|---:|---:|---:|---:|\n${report.cases.map(c => `| ${c.name} | ${c.loops} | ${c.avgMs} | ${c.medianMs} | ${c.p95Ms} |`).join('\n')}\n`);
console.log(JSON.stringify(report, null, 2));
