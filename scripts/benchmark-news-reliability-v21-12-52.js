import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] || 0;
}
function stats(values) {
  return {
    avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)),
    median: Number(percentile(values, 50).toFixed(3)),
    p95: Number(percentile(values, 95).toFixed(3)),
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

const originalFetch = globalThis.fetch;
let fetchCount = 0;
const xml = `<rss><channel><item><title><![CDATA[PETR4 Petrobras anuncia dividendos na B3]]></title><link>https://news.example/petr4</link><pubDate>Fri, 29 May 2026 12:00:00 GMT</pubDate><source>Agência Teste</source><description><![CDATA[Petrobras PETR4 informa proventos e resultado.]]></description></item></channel></rss>`;

globalThis.fetch = async () => {
  fetchCount += 1;
  await new Promise(r => setTimeout(r, 4));
  return { ok: true, status: 200, text: async () => xml };
};

try {
  clearValoraeCaches('news');
  const coldTimes = [];
  for (let i = 0; i < 5; i++) {
    clearValoraeCaches('news');
    const t0 = performance.now();
    const out = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 5, newsTimeoutMs: 500 });
    coldTimes.push(performance.now() - t0);
    if (!out.ok || out.items.length !== 1) throw new Error('news cold failed');
  }
  clearValoraeCaches('news');
  await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 5, newsTimeoutMs: 500 });
  const hotTimes = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    const out = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 5, newsTimeoutMs: 500 });
    hotTimes.push(performance.now() - t0);
    if (!out.ok || out.cacheStatus !== 'NEWS_CACHE_HIT') throw new Error('news hot cache failed');
  }
  clearValoraeCaches('news');
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<rss><channel></channel></rss>' });
  const empty = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 5, newsTimeoutMs: 500 });
  if (empty.ok || empty.code !== 'GOOGLE_NEWS_EMPTY') throw new Error('empty RSS semantics failed');
  const report = {
    version: '21.12.52-news-reliability-upgrade',
    fetchCount,
    cold: stats(coldTimes),
    hot: stats(hotTimes),
    hotCacheStatus: 'NEWS_CACHE_HIT',
    emptySemantics: { ok: empty.ok, code: empty.code, shouldKeepPreviousNews: empty.appPolicy?.shouldKeepPreviousNews },
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/benchmark-news-reliability-v21.12.52.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('news');
}
