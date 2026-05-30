import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import scrapeHandler from '../routes/scrape.js';
import batchScrapeHandler from '../routes/batch-scrape.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { clearScrapeResultCache } from '../lib/cache/scrape-result-cache.js';

function mockRes() {
  return { statusCode: 200, headers: {}, setHeader(k,v){ this.headers[String(k).toLowerCase()] = String(v); }, getHeader(k){ return this.headers[String(k).toLowerCase()]; }, removeHeader(k){ delete this.headers[String(k).toLowerCase()]; }, status(c){ this.statusCode = c; return this; }, send(b){ this.body = String(b ?? ''); return this; }, end(b=''){ this.body = String(b ?? ''); return this; } };
}
let reqSeq = 0;
function req({ method='GET', url='/api/scrape', query={}, body }={}) { reqSeq += 1; return { method, url, query, body, headers:{ 'x-forwarded-for': `127.0.0.${(reqSeq % 200) + 1}` }, socket:{} }; }
function parse(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
function stats(values) { const sorted=[...values].sort((a,b)=>a-b); const sum=values.reduce((a,b)=>a+b,0); const pick=p=>sorted[Math.min(sorted.length-1, Math.max(0, Math.ceil((p/100)*sorted.length)-1))] || 0; return { avg: +(sum/values.length).toFixed(3), median:+pick(50).toFixed(3), p95:+pick(95).toFixed(3), min:+sorted[0].toFixed(3), max:+sorted.at(-1).toFixed(3) }; }
async function time(fn) { const t=performance.now(); const value=await fn(); return { ms: performance.now()-t, value }; }

const original = ValoraeEngine.scrapeUrl;
let fetches = 0;
ValoraeEngine.scrapeUrl = async url => {
  fetches += 1;
  await new Promise(r => setTimeout(r, 3));
  const blocks = Array.from({ length: 240 }, (_, i) => `<li class="row"><span class="name">Indicador ${i}</span><span class="value">R$ ${(i+1)*1.13}</span></li>`).join('');
  return { ok:true, status:200, url, finalUrl:url, hostname:new URL(url).hostname, contentType:'text/html', html:`<html><body><h1>PETR4</h1><span class="price">R$ 38,10</span><span class="dy">8,40%</span><ul>${blocks}</ul></body></html>`, htmlLength: blocks.length + 100, rawHtmlLength: blocks.length + 100, selectorResults:{}, provider:'MockFetch', cache:'MISS', elapsedMs:3 };
};

try {
  clearScrapeResultCache();
  const query = { url:'https://investidor10.com.br/acoes/petr4/', selectors: JSON.stringify({ title:'h1', price:'.price', dy:'.dy', values:'.value' }), profile:'scrape-fast', includeCharts:'0', includeDiagnostics:'0', cache:'1', compact:'1' };
  const cold = await time(async () => { const r=mockRes(); await scrapeHandler(req({ query }), r); return { status:r.statusCode, cache:r.headers['x-valorae-cache'], body:parse(r) }; });
  const hotTimes=[];
  for (let i=0;i<50;i++) hotTimes.push((await time(async()=>{ const r=mockRes(); await scrapeHandler(req({ query }), r); return r.headers['x-valorae-cache']; })).ms);
  const hotStats = stats(hotTimes);

  clearScrapeResultCache();
  fetches = 0;
  const concurrentTimed = await time(async () => Promise.all(Array.from({ length:25 }, async () => { const r=mockRes(); await scrapeHandler(req({ query }), r); return parse(r).ok; })));

  clearScrapeResultCache();
  fetches = 0;
  const jobs = Array.from({ length:20 }, (_,i)=>({ id:`j${i}`, url:'https://investidor10.com.br/acoes/petr4/', selectors:{ title:'h1', price:'.price' }}));
  const batchBody = { jobs, batchProfile:'fast', cache:'1', concurrency:4 };
  const batchCold = await time(async()=>{ const r=mockRes(); await batchScrapeHandler(req({ method:'POST', url:'/api/batch-scrape', body: batchBody }), r); return parse(r); });
  const batchHot = await time(async()=>{ const r=mockRes(); await batchScrapeHandler(req({ method:'POST', url:'/api/batch-scrape', body: batchBody }), r); return parse(r); });

  const report = {
    version: '21.12.52-news-reliability-upgrade',
    generatedAt: new Date().toISOString(),
    scrapeFastCold: { ms:+cold.ms.toFixed(3), status:cold.value.status, cache:cold.value.cache, ok:cold.value.body.ok, responseBytes:Number(cold.value.body.metrics?.responseBytes || 0), coveragePercent:cold.value.body.precision?.coveragePercent },
    scrapeFastHot: hotStats,
    concurrent25SameUrl: { ms:+concurrentTimed.ms.toFixed(3), ok:concurrentTimed.value.filter(Boolean).length, fetches },
    batch20DuplicatedCold: { ms:+batchCold.ms.toFixed(3), logical:batchCold.value.logical, execution:batchCold.value.execution },
    batch20DuplicatedHot: { ms:+batchHot.ms.toFixed(3), logical:batchHot.value.logical, execution:batchHot.value.execution },
  };
  fs.mkdirSync('reports', { recursive:true });
  fs.writeFileSync('reports/benchmark-post-benchmark-v21.12.52.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  ValoraeEngine.scrapeUrl = original;
  clearScrapeResultCache();
}
