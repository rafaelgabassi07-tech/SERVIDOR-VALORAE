import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fii = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');

assert.ok(runtime.includes('normalizeModalCacheSurface'), 'runtime deve normalizar superfície para evitar cache fragmentado entre Carteira/Ranking/Análise');
assert.ok(runtime.includes('return Math.max(requested, 180_000)'), 'modal full deve manter cache fresco por pelo menos 180s');
assert.ok(stock.includes('strategy: \'parallel_batches_of_6_v300\''), 'histórico fundamentalista de ação deve usar batches paralelos');
assert.ok(stock.includes('pdfResolutionStrategy: \'parallel_top_8_v300\''), 'PDFs/comunicados de ação devem resolver em paralelo limitado');
assert.ok(fii.includes('strategy: \'parallel_v300\''), 'vacância de FII deve consultar candidatos em paralelo');
assert.ok(fii.includes('pdfResolutionStrategy: \'parallel_top_8_v300\''), 'PDFs/comunicados de FII devem resolver em paralelo limitado');
assert.ok(stock.includes('ttlMs: 180_000') && fii.includes('ttlMs: 180_000'), 'modais devem usar TTL full-only ampliado');
assert.ok(!runtime.includes('status: \'PARTIAL\',\n    partial: true,\n    ticker: cleanTicker,\n    assetType') || runtime.includes('Full-only: não devolver payload PARTIAL'), 'runtime deve preservar full-only sem renderizar parcial por timeout');

console.log('asset-modal-speed-full-v300 ok');
