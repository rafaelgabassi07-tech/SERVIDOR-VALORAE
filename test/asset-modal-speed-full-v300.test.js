import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALORAE_MOBILE_CACHE_POLICY_SECONDS } from '../lib/core/mobile-protocol.js';

const runtime = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
const stock = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fii = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');

assert.ok(runtime.includes('normalizeModalCacheSurface'), 'runtime deve normalizar superfície para evitar cache fragmentado entre Carteira/Ranking/Análise');
assert.equal(VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull, 180, 'modal full deve manter cache fresco por 180s');
assert.ok(runtime.includes('VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull * 1000'), 'runtime deve consumir a política de cache compartilhada');
assert.ok(stock.includes('strategy: \'parallel_batches_of_6_v300\''), 'histórico fundamentalista de ação deve usar batches paralelos');
assert.ok(stock.includes('pdfResolutionStrategy: \'parallel_top_8_v300\''), 'PDFs/comunicados de ação devem resolver em paralelo limitado');
assert.ok(fii.includes('strategy: \'parallel_v300\''), 'vacância de FII deve consultar candidatos em paralelo');
assert.ok(fii.includes('pdfResolutionStrategy: \'parallel_top_8_v300\''), 'PDFs/comunicados de FII devem resolver em paralelo limitado');
assert.ok(stock.includes("ttlMs: modalPayload.stage === 'fast' ? 35_000 : 180_000") && fii.includes("ttlMs: modalPayload.stage === 'fast' ? 35_000 : 180_000"), 'modais devem separar TTL fast/full');
assert.ok(runtime.includes("return Math.min(23000, Math.max(9000, safe))"), 'stage full deve acomodar fontes históricas reais sem eliminar o preview fast');
assert.ok(runtime.includes("if (isModalDeadlineError(error))"), 'deadline deve ser convertido em resposta parcial controlada, preservando o fast no APK');
assert.ok(stock.includes('deferredStockIndexComparison') && fii.includes('deferredFiiIndexComparison'), 'stage fast deve adiar comparadores pesados');

console.log('asset-modal-speed-full-v300 ok');
