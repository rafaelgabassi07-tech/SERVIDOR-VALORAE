import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASSET_MODAL_GATEWAY_VERSION, buildAssetModalContract, resolveAssetModalFamily } from '../lib/analysis/asset-modal-contract.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const stockContract = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const fiiContract = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const apkRuntime = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalRuntime.kt');
const apkService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalService.kt');
const apkUniversalService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const apkFallback = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFallbackPolicy.kt');
const apkMerge = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
const apkRuntimeCache = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');

assert.equal(ASSET_MODAL_GATEWAY_VERSION, '26.asset-modal.gateway.v1');
assert.equal(resolveAssetModalFamily({ ticker: 'PETR4' }).family, 'stock');
assert.equal(resolveAssetModalFamily({ ticker: 'MXRF11' }).family, 'fii');
assert.equal(resolveAssetModalFamily({ ticker: 'TAEE11' }).family, 'stock', 'unit terminada em 11 não pode abrir rota de FII primeiro');
assert.equal(resolveAssetModalFamily({ ticker: 'TAEE11', assetType: 'FII' }).family, 'stock', 'classificação confiável do ticker deve prevalecer sobre hint antigo conflitante');

assert.ok(router.includes("path === '/asset/modal'"), 'router deve publicar o endpoint universal');
assert.ok(router.includes("'/asset/modal'"), 'manifest deve anunciar o endpoint universal');
assert.ok(stockContract.includes('const sourceTimeoutMs = fastMode ? Math.max(Number(timeoutMs) || 0, 6500) : timeoutMs'), 'fast de ação não pode encurtar a captura compartilhada do full');
assert.ok(fiiContract.includes('const sourceTimeoutMs = fastMode ? Math.max(Number(timeoutMs) || 0, 6500) : timeoutMs'), 'fast de FII não pode encurtar a captura compartilhada do full');
assert.ok(stockContract.includes('timeoutMs: sourceTimeoutMs') && stockContract.includes('retries: 1'), 'ação deve usar orçamento resiliente na origem compartilhada');
assert.ok(fiiContract.includes('timeoutMs: sourceTimeoutMs') && fiiContract.includes('retries: 1'), 'FII deve usar orçamento resiliente na origem compartilhada');
assert.ok(stockContract.includes('ttlMs: 10 * 60_000'), 'HTML fundamentalista de ação deve ser reutilizado entre reaberturas sem afetar a cotação em tempo real');
assert.ok(fiiContract.includes('ttlMs: 10 * 60_000') && fiiContract.includes('staleMs: 8 * 60 * 60 * 1000'), 'HTML fundamentalista de FII deve ter cache e stale alinhados entre fast/full');
assert.ok(stockContract.includes('fetchYahooLogo(ticker, { timeoutMs: Math.min(3800'), 'logo oficial da ação deve ter orçamento resiliente equivalente ao FII');

if (apkRuntime && apkService && apkUniversalService && apkFallback && apkMerge && apkRuntimeCache) {
  assert.ok(apkRuntime.includes('ValoraeProxyClient.getAssetModalContract'), 'APK deve consumir uma única rota universal');
  assert.ok(apkRuntime.includes('isUniversalAssetModalRouteUnavailable'), 'fallback legado deve ocorrer apenas quando o Proxy antigo não possui a rota');
  assert.ok(apkService.includes('ValoraeUniversalAssetModalService.getAssetModalContract'), 'fachada APK deve delegar ao núcleo universal isolado');
  assert.ok(apkUniversalService.includes('"/api/v1/asset/modal"'), 'núcleo universal APK deve consultar o gateway universal');
  assert.ok(apkUniversalService.includes('APK_STALE_IF_ERROR'), 'APK deve preservar cache stale útil em falha transitória');
  assert.ok(apkRuntimeCache.includes('assetModalCache = ConcurrentHashMap'), 'cache universal deve ser isolado dos caches legados por família');
  assert.ok(apkUniversalService.includes('cached.value.shouldCacheUniversalModalContract()'), 'cache universal não deve aceitar contratos vazios nem full de baixa completude');
  assert.ok(apkFallback.includes('mergeSingleAssetModalPayload'), 'resolver progressivo deve aplicar o merge real');
  assert.ok(apkMerge.includes('companyProfile = preferNonDefault'), 'merge deve preservar seções profundas de ação');
  assert.ok(apkMerge.includes('propertyPortfolio = preferNonDefault'), 'merge deve preservar seções profundas de FII');
  assert.ok(apkMerge.includes('availableSections = available'), 'metadados de entrega devem refletir a união das seções');
}

const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
process.env.VALORAE_DISABLE_EXTERNAL = '1';
try {
  const stock = await buildAssetModalContract({ ticker: 'PETR4', assetType: 'ACAO', stage: 'fast', timeoutMs: 1200 });
  const unit = await buildAssetModalContract({ ticker: 'TAEE11', assetType: 'FII', stage: 'fast', timeoutMs: 1200 });
  const fii = await buildAssetModalContract({ ticker: 'MXRF11', assetType: 'FII', stage: 'fast', timeoutMs: 1200 });
  assert.equal(stock.resolvedFamily, 'stock');
  assert.equal(stock.assetType, 'ACAO');
  assert.equal(stock.delivery?.deliveredStage, 'fast');
  assert.equal(unit.resolvedFamily, 'stock');
  assert.equal(unit.assetType, 'ACAO_UNIT');
  assert.equal(unit.delivery?.deliveredStage, 'fast');
  assert.equal(fii.resolvedFamily, 'fii');
  assert.equal(fii.assetType, 'FII');
  assert.equal(fii.delivery?.deliveredStage, 'fast');
} finally {
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}

console.log('asset-modal-gateway-source-budget-v304 ok');
