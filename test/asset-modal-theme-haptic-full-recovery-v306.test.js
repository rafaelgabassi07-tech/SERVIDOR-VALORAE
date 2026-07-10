import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache } from '../lib/core/cache.js';
import { _test, withAssetModalRuntime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const timeoutFull = _test.modalTimeoutPayload({
  family: 'stock',
  ticker: 'PETR4',
  stage: 'full',
  deadlineMs: 12000,
  elapsedMs: 12001
});
const timeoutDelivery = _test.buildModalDelivery(timeoutFull, {
  family: 'stock',
  requestedMode: 'full',
  mode: 'full'
});
assert.equal(timeoutDelivery.isFinal, false, 'deadline full não pode se declarar resposta final');
assert.equal(timeoutDelivery.retryable, true, 'deadline full deve permitir recuperação controlada');
assert.ok(timeoutDelivery.deferredSections.length > 0, 'seções faltantes devem continuar adiadas durante retry');

const basicOnlyFull = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  ticker: 'PETR4',
  quoteSummary: { price: 31.5, priceDisplay: 'R$ 31,50' },
  chart: { points: [{ close: 31.2 }, { close: 31.5 }] },
  metrics: [{ id: 'price', value: 'R$ 31,50' }]
};
assert.ok(_test.modalPayloadCompletenessPercent(basicOnlyFull, 'stock') < 40);
assert.equal(_test.isModalPayloadCacheable(basicOnlyFull, 'stock'), false, 'full só com básico não pode congelar o modal no cache');

const richFull = {
  ...basicOnlyFull,
  fundamentalIndicators: { items: [{ id: 'pl', value: '6,2' }] },
  historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
  checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
  dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  companyProfile: { facts: [{ id: 'segment', value: 'Petróleo' }], sections: [] },
  revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
  returns: { rows: [{ label: '12M', value: '10%' }] }
};
assert.equal(_test.isModalPayloadCacheable(richFull, 'stock'), true, 'full com seções profundas deve ser reutilizado');

clearCache();
let producerCalls = 0;
const producer = async () => {
  producerCalls += 1;
  await sleep(2100);
  return {
    ok: true,
    status: 'OK',
    stage: 'fast',
    mode: 'fast',
    ticker: 'LATE4',
    quoteSummary: { price: 15.2, priceDisplay: 'R$ 15,20' },
    chart: { points: [{ close: 15.0 }, { close: 15.2 }] },
    metrics: [{ id: 'price', value: 'R$ 15,20' }]
  };
};
const first = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'LATE4',
  payload: { stage: 'fast', timeoutMs: 1800, surface: 'late-producer-test' },
  producer
});
assert.equal(first.status, 'PARTIAL');
assert.equal(first.delivery.retryable, true);
const secondStartedAt = Date.now();
const second = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'LATE4',
  payload: { stage: 'fast', timeoutMs: 1800, surface: 'late-producer-test' },
  producer
});
assert.equal(second.quoteSummary.price, 15.2, 'segunda tentativa deve se conectar ao producer ainda vivo');
assert.ok(Date.now() - secondStartedAt < 900, 'segunda tentativa não deve reiniciar todo o trabalho externo');
assert.equal(producerCalls, 1, 'deadline HTTP não deve duplicar a captura profunda em andamento');
await sleep(10);
assert.equal(_test.modalProducerFlightCount(), 0, 'flight concluído deve ser removido do registro');

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
assert.ok(stockSource.includes("reason: 'source_warming'"), 'extras lentos devem ser adiados sem bloquear seções HTML profundas');
assert.ok(stockSource.includes("'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7'"), 'captura HTML deve anunciar locale compatível com a fonte brasileira');

const colorKt = readSiblingApkFile('app/src/main/java/com/example/ui/theme/Color.kt');
const themeKt = readSiblingApkFile('app/src/main/java/com/example/ui/theme/Theme.kt');
const settingsKt = readSiblingApkFile('app/src/main/java/com/example/ui/SettingsPages.kt');
const agendaKt = readSiblingApkFile('app/src/main/java/com/example/ui/DividendAgendaModalComponents.kt');
const dividendsKt = readSiblingApkFile('app/src/main/java/com/example/ui/DividendsEvolutionModalComponents.kt');
const hapticKt = readSiblingApkFile('app/src/main/java/com/example/ui/ValoraeHapticFeedback.kt');
const manifest = readSiblingApkFile('app/src/main/AndroidManifest.xml');
const loaderKt = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const qualityKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeAssetModalQuality.kt');

if (colorKt && themeKt && settingsKt && agendaKt && dividendsKt && hapticKt && manifest && loaderKt && qualityKt) {
  assert.ok(colorKt.includes('GoldClassicPrimaryLight = Color(0xFF8A6100)'), 'Ouro Classic deve ter paleta própria');
  assert.ok(themeKt.includes('primaryLight = GoldClassicPrimaryLight'), 'tema Ouro Classic deve usar a paleta dourada');
  assert.ok(settingsKt.includes('ColorTheme.Gold to listOf(Color(0xFF8A6100)'), 'prévia do Ouro Classic deve corresponder ao tema real');
  assert.ok(!colorKt.includes('val ValoraeYellow = Color(0xFF64748B)'), 'amarelo semântico não pode regredir para cinza');
  assert.ok(colorKt.includes('Color(0xFFFFD166)') && colorKt.includes('Color(0xFFA76400)'), 'amarelo semântico deve preservar contraste claro/escuro');
  assert.ok(agendaKt.includes('color = ValoraeYellow') && agendaKt.includes('tint = ValoraeYellow'), 'Data COM e Próximo devem manter cor semântica');
  assert.ok(dividendsKt.includes('valueColor = ValoraeYellow'), 'métrica A receber deve manter amarelo semântico');
  assert.ok(manifest.includes('android.permission.VIBRATE'), 'APK deve declarar permissão de vibração');
  assert.ok(hapticKt.includes('VibratorManager') && hapticKt.includes('VibrationEffect.createOneShot'), 'retorno tátil deve possuir execução física explícita');
  assert.ok(loaderKt.includes('AssetModalFullRecoveryDelaysMs') && loaderKt.includes('700L, 1_500L, 2_800L') && loaderKt.includes('recovery = true'), 'APK deve recuperar o full incompleto enquanto o modal permanece aberto');
  assert.ok(qualityKt.includes('StockModalStableCachePercent = 62') && qualityKt.includes('FiiModalStableCachePercent = 58'), 'full básico não pode entrar no cache estável do APK');
}

console.log('asset-modal-theme-haptic-full-recovery-v306 ok');
